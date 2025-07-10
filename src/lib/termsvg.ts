import { execSync } from 'child_process';
import { platform, arch } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';
import type { PlatformInfo } from '../types.js';
import { safeDeleteExistingCast } from './file.js';

export function getTermSVGInstallCommand(): string {
  const currentPlatform = platform();
  
  switch (currentPlatform) {
    case 'darwin':
    case 'linux':
      return 'curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-termsvg.sh | bash -';
    case 'win32':
      return 'Download from: https://github.com/MrMarble/termsvg/releases (Windows recording limited)';
    default:
      return 'go install github.com/mrmarble/termsvg/cmd/termsvg@latest';
  }
}

export function getTermSVGInstallInstructions(): string[] {
  const currentPlatform = platform();
  
  const common = [
    '📦 Install termsvg for SVG generation:',
    '',
    '🚀 Quick install (recommended):',
    '   curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-termsvg.sh | bash -',
    '',
    '🔧 Alternative methods:'
  ];

  const platformSpecific = [];
  
  switch (currentPlatform) {
    case 'darwin':
      platformSpecific.push(
        '   # macOS with install script',
        '   curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-termsvg.sh | bash -',
        '   # Or with Go:',
        '   go install github.com/mrmarble/termsvg/cmd/termsvg@latest'
      );
      break;
    case 'linux':
      platformSpecific.push(
        '   # Linux with install script',
        '   curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-termsvg.sh | bash -',
        '   # Or with Go:',
        '   go install github.com/mrmarble/termsvg/cmd/termsvg@latest'
      );
      break;
    case 'win32':
      platformSpecific.push(
        '   # Windows',
        '   # Download binary from: https://github.com/MrMarble/termsvg/releases',
        '   # Note: Recording not supported on Windows, export only'
      );
      break;
  }
  
  platformSpecific.push(
    '   # With Go',
    '   go install github.com/mrmarble/termsvg/cmd/termsvg@latest',
    '',
    '   # Manual download',
    '   # https://github.com/MrMarble/termsvg/releases',
    '',
    '✅ Verify installation:',
    '   termsvg --help'
  );

  return [...common, ...platformSpecific];
}

export async function checkTermSVGAvailability(): Promise<{
  available: boolean;
  version?: string;
  path?: string;
  supportsRecording?: boolean;
  installCommand?: string;
  installInstructions?: string[];
}> {
  const termsvgPath = getTermSVGPath();
  
  try {
    // Check if termsvg is available
    const versionOutput = execSync(`"${termsvgPath}" --help`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Try to get version from help output or version command
    let version = 'unknown';
    try {
      const versionCheck = execSync(`"${termsvgPath}" --version`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      version = versionCheck.trim();
    } catch {
      // Some versions might not have --version, extract from help
      const versionMatch = versionOutput.match(/termsvg\s+v?(\d+\.\d+\.\d+)/i);
      if (versionMatch) {
        version = versionMatch[1];
      }
    }
    
    // Check which commands are available
    const supportsRecording = versionOutput.includes('rec') && platform() !== 'win32';
    
    return {
      available: true,
      version,
      path: termsvgPath,
      supportsRecording
    };
  } catch (error) {
    
    return {
      available: false,
      supportsRecording: false,
      installCommand: getTermSVGInstallCommand(),
      installInstructions: getTermSVGInstallInstructions()
    };
  }
}

export function getTermSVGPath(): string {
  // Enterprise escape hatch
  if (process.env.DG_GPL_OFF === '1') {
    return 'termsvg'; // Use PATH only
  }

  // Check local installation first
  const localPath = join(process.cwd(), '.dg', 'bin', 'termsvg');
  
  if (existsSync(localPath)) {
    return localPath;
  }
  
  // Fallback to PATH
  return 'termsvg';
}

export async function installTermSVGInteractive(): Promise<boolean> {
  const currentPlatform = platform();
  
  console.log('\n🔧 termsvg not found. Installing...\n');
  
  try {
    switch (currentPlatform) {
      case 'darwin':
      case 'linux':
        console.log('📦 Attempting to install via remote script...');
        try {
          // Check if this is a global installation
          const isGlobalInstall = process.env.npm_config_global === 'true' || 
                                 process.env.npm_config_prefix || 
                                 process.argv.includes('--global');
          
          const installCommand = isGlobalInstall 
            ? 'curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-termsvg.sh | sudo -E bash -'
            : 'curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-termsvg.sh | bash -';
          
          execSync(installCommand, { stdio: 'inherit' });
          console.log('✅ termsvg installed successfully!');
          return true;
        } catch (installError) {
          console.log('❌ Remote install script failed');
          console.log('💡 Please install manually:');
          console.log('   # Try Go installation:');
          console.log('   go install github.com/mrmarble/termsvg/cmd/termsvg@latest');
          console.log('   # Or download from: https://github.com/MrMarble/termsvg/releases');
          return false;
        }
        
      default:
        console.log('❌ Automatic installation not supported on this platform');
        console.log('\n💡 Please install manually:');
        getTermSVGInstallInstructions().forEach(line => console.log(line));
        return false;
    }
  } catch (error) {
    console.log('❌ Installation failed:', (error as Error).message);
    console.log('\n💡 Please install manually:');
    getTermSVGInstallInstructions().forEach(line => console.log(line));
    return false;
  }
}

export async function exportSVG(
  castPath: string, 
  outputPath: string, 
  options: { 
    minify?: boolean;
  } = {}
): Promise<boolean> {
  const { minify = true } = options;
  
  // Get the appropriate termsvg path
  const availability = await checkTermSVGAvailability();
  if (!availability.available) {
    console.error('termsvg not available');
    console.log('💡 Install termsvg:');
    getTermSVGInstallInstructions().forEach(line => console.log('   ' + line));
    return false;
  }
  
  const termsvgPath = availability.path || 'termsvg';
  
  try {
    const args = [
      `"${termsvgPath}"`,
      'export',
      `"${castPath}"`,
      '--output', `"${outputPath}"`
    ];
    
    if (minify) {
      args.push('--minify');
    }
    
    execSync(args.join(' '), {
      stdio: 'pipe'
    });
    
    return true;
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('SVG export failed:', errorMessage);
    
    // Parse specific termsvg errors
    if (errorMessage.includes('command not found') || errorMessage.includes('No such file')) {
      console.log('💡 Install termsvg:');
      getTermSVGInstallInstructions().forEach(line => console.log('   ' + line));
    } else if (errorMessage.includes('No such file') && errorMessage.includes(castPath)) {
      console.log('💡 Cast file not found:', castPath);
      console.log('   Make sure the asciinema recording exists');
    } else if (errorMessage.includes('Permission denied')) {
      console.log('💡 Check file permissions or try running with appropriate permissions.');
    } else {
      console.log('💡 Check that termsvg is working properly.');
      console.log(`   Test: ${termsvgPath} --help`);
    }
    
    return false;
  }
} 

export async function recordInteractiveDemo(
  outputPath: string, 
  options: { 
    cols?: number; 
    rows?: number; 
    env?: Record<string, string>;
    overwrite?: boolean;
    onCommand?: (command: string) => void;
  } = {}
): Promise<boolean> {
  const availability = await checkTermSVGAvailability();
  if (!availability.available) {
    console.error('termsvg not available');
    console.log('💡 Install termsvg:');
    getTermSVGInstallInstructions().forEach(line => console.log('   ' + line));
    return false;
  }
  
  if (!availability.supportsRecording) {
      console.error('termsvg does not support recording on this platform');
      console.log('💡 Recording is not supported on Windows');
      return false;
    }
  
  const termsvgPath = availability.path || 'termsvg';
  const { cols = 120, rows = 30, env = {}, overwrite = false, onCommand } = options;
  
  // Proactively delete existing cast file if overwrite is requested
  if (overwrite) {
    if (existsSync(outputPath)) {
      const deleteSuccess = safeDeleteExistingCast(outputPath);
      if (!deleteSuccess) {
        return false;
      }
    }
  }
  
  const recordEnv = {
    ...process.env,
    ...env,
    // Terminal dimensions
    COLUMNS: cols.toString(),
    LINES: rows.toString(),
    // Terminal type and capabilities
    TERM: 'xterm-256color',
    // Fix cursor positioning issues
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    // Suppress shell initialization and prompts
    SHELL: '/bin/sh', // Force basic shell
    PS1: '', // Empty prompt
    PS2: '',
    PS3: '',
    PS4: '',
    PROMPT_COMMAND: '',
    // Disable shell history and rc files
    HISTFILE: '/dev/null',
    HISTSIZE: '0',
    HISTFILESIZE: '0',
    HISTCONTROL: 'ignoreboth',
    // Disable all shell rc/profile files
    ZDOTDIR: '/dev/null',
    BASH_ENV: '/dev/null',
    ENV: '/dev/null',
    BASHRC: '/dev/null',
    BASH_PROFILE: '/dev/null',
    PROFILE: '/dev/null',
    // Force non-interactive mode
    PS0: '',
    RPROMPT: '',
    RPS1: '',
    RPS2: '',
    // Prevent cursor positioning issues
    ZLE_RPROMPT_INDENT: '0',
    // Disable shell completion
    FIGNORE: '*',
    BASH_COMPLETION_USER_DIR: '/dev/null'
  };
  
  try {
    // Import node-pty for interactive recording
    const pty = await import('node-pty');

    // Create a PTY instance with proper configuration
    // termsvg rec only takes the output file as argument, no --cols/--rows flags
    const ptyProcess = pty.spawn(termsvgPath, ['rec', outputPath], {
      name: 'xterm-256color',
      cols,
      rows,
      env: recordEnv,
      cwd: process.cwd()
    });

    // Set up raw mode for input
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Forward PTY output to stdout
    ptyProcess.onData((data) => {
      try {
        process.stdout.write(data.toString());
      } catch (err) {
        console.error('Error writing to stdout:', err);
      }
    });

    // Forward user input to PTY
    let currentCommand = '';
    process.stdin.on('data', (data) => {
      try {
        const str = data.toString();
        if (str === '\r' || str === '\n') {
          if (currentCommand.trim() && onCommand) {
            onCommand(currentCommand.trim());
          }
          currentCommand = '';
        } else if (str === '\u007f' || str === '\b') { // Backspace
          currentCommand = currentCommand.slice(0, -1);
        } else {
          currentCommand += str;
        }
        ptyProcess.write(str);
      } catch (err) {
        console.error('Error writing to pty:', err);
      }
    });

    // Handle terminal session end
    ptyProcess.onExit(() => {
      // Clean up terminal state
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      process.stdin.setEncoding('utf8');
      process.stdout.write('\r\n');
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      ptyProcess.kill();
    });

    // Wait for the process to exit
    return new Promise((resolve) => {
      ptyProcess.onExit(({ exitCode }) => {
        // Clean up
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        process.stdin.removeAllListeners('data');
        process.removeAllListeners('SIGINT');
        resolve(exitCode === 0);
      });
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Recording failed:', errorMessage);
    
    // Enhanced error handling with specific solutions
    if (errorMessage.includes('already exists')) {
      console.log('❌ Cast file still exists after deletion attempt');
      console.log('💡 Possible solutions:');
      console.log('   1. Delete the file manually:', outputPath);
      console.log('   2. Check file permissions');
      console.log('   3. Close any applications that might be using the file');
    } else if (errorMessage.includes('command not found') || errorMessage.includes('No such file')) {
      console.log('💡 termsvg not found. Install it:');
      getTermSVGInstallInstructions().forEach(line => console.log('   ' + line));
    } else if (errorMessage.includes('Permission denied')) {
      console.log('💡 Permission denied. Try:');
      console.log('   1. Check file/directory permissions');
      console.log('   2. Run with appropriate permissions');
      console.log('   3. Ensure output directory is writable');
    } else if (errorMessage.includes('timeout') || errorMessage.includes('killed')) {
      console.log('💡 Recording timed out or was interrupted');
      console.log('   This is normal if you pressed Ctrl+C to stop recording');
    } else {
      console.log('💡 Unexpected error. Debug steps:');
      console.log(`   1. Test: ${termsvgPath} --help`);
      console.log('   2. Check terminal compatibility');
      console.log('   3. Try recording manually: termsvg rec test.cast');
    }
    return false;
  }
}

export async function recordDemo(
  command: string, 
  outputPath: string, 
  options: { 
    cols?: number; 
    rows?: number; 
    env?: Record<string, string>;
    overwrite?: boolean;
  } = {}
): Promise<boolean> {
  const availability = await checkTermSVGAvailability();
  if (!availability.available) {
    console.error('termsvg not available');
    console.log('💡 Install termsvg:');
    getTermSVGInstallInstructions().forEach(line => console.log('   ' + line));
    return false;
  }
  
  if (!availability.supportsRecording) {
      console.error('termsvg does not support recording on this platform');
      console.log('💡 Recording is not supported on Windows');
      return false;
    }
  
  const termsvgPath = availability.path || 'termsvg';
  const { cols = 120, rows = 30, env = {}, overwrite = false } = options;
  
  // Proactively delete existing cast file if overwrite is requested
  if (overwrite) {
    if (existsSync(outputPath)) {
      const deleteSuccess = safeDeleteExistingCast(outputPath);
      if (!deleteSuccess) {
        return false;
      }
    }
  }
  
  const recordEnv = {
    ...process.env,
    ...env,
    COLUMNS: cols.toString(),
    LINES: rows.toString(),
    TERM: 'xterm-256color'
  };
  
  try {
    // termsvg rec only takes the output file as argument, and -c for command
    const args = [
      `"${termsvgPath}"`,
      'rec',
      `"${outputPath}"`,
      '-c', `"${command}"`
    ];
    
    execSync(args.join(' '), {
      env: recordEnv,
      stdio: 'inherit'
    });
    
    return true;
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Recording failed:', errorMessage);
    
    // Enhanced error handling with specific solutions
    if (errorMessage.includes('already exists')) {
      console.log('❌ Cast file still exists after deletion attempt');
      console.log('💡 Possible solutions:');
      console.log('   1. Delete the file manually:', outputPath);
      console.log('   2. Check file permissions');
      console.log('   3. Close any applications that might be using the file');
    } else if (errorMessage.includes('command not found') || errorMessage.includes('No such file')) {
      console.log('💡 termsvg not found. Install it:');
      getTermSVGInstallInstructions().forEach(line => console.log('   ' + line));
    } else if (errorMessage.includes('Permission denied')) {
      console.log('💡 Permission denied. Try:');
      console.log('   1. Check file/directory permissions');
      console.log('   2. Run with appropriate permissions');
      console.log('   3. Ensure output directory is writable');
    } else if (errorMessage.includes('timeout') || errorMessage.includes('killed')) {
      console.log('💡 Recording timed out or was interrupted');
      console.log('   This is normal if you pressed Ctrl+C to stop recording');
    } else {
      console.log('💡 Unexpected error. Debug steps:');
      console.log(`   1. Test: ${termsvgPath} --help`);
      console.log('   2. Check terminal compatibility');
      console.log(`   3. Try recording manually: ${termsvgPath} rec test.cast`);
    }
    
    return false;
  }
} 