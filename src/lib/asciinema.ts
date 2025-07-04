import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type { PlatformInfo } from '../types.js';
import { downloadFile, ensureDirectoryExists, safeDeleteExistingCast } from './file.js';
import { dgLogger as logger } from './logger.js';

// Set PTY library path to be next to binary
if (!process.env.BUN_PTY_LIB) {
  const binaryDir = dirname(process.argv[1]);
  const libName = process.platform === 'darwin'
    ? `librust_pty_${process.arch === 'arm64' ? 'arm64' : 'x64'}.dylib`
    : 'librust_pty.so';
  process.env.BUN_PTY_LIB = join(binaryDir, libName);
}

const LEGAL_NOTICE_SHOWN_KEY = 'DG_ASCIINEMA_LEGAL_NOTICE_SHOWN';

export function getAsciinemaCompatibility(): PlatformInfo {
  const platform = process.platform;
  const arch = process.arch;
  const platformKey = `${platform}-${arch}` as 'darwin-arm64' | 'darwin-x64' | 'linux-x64';
  
  const SUPPORTED_PLATFORMS = {
    'darwin-arm64': true,
    'darwin-x64': true,
    'linux-x64': true,
  };

  return {
    platform,
    arch,
    supported: SUPPORTED_PLATFORMS[platformKey] || false,
    fallbackToPath: !SUPPORTED_PLATFORMS[platformKey]
  };
}

export function detectLinuxVariant(): string {
  try {
    execSync('ldd --version', { stdio: 'ignore' });
    return 'glibc';
  } catch {
    return 'musl'; // Alpine, likely
  }
}

function hasShownLegalNotice(): boolean {
  return process.env[LEGAL_NOTICE_SHOWN_KEY] === '1';
}

function markLegalNoticeShown(): void {
  process.env[LEGAL_NOTICE_SHOWN_KEY] = '1';
}

export async function downloadAsciinema(): Promise<string | null> {
  const platformInfo = getAsciinemaCompatibility();
  const version = '3.0.0-rc.5'; // Latest stable version
  
  // Map our platform info to asciinema's naming
  const platformMap: Record<string, string> = {
    'darwin-x64': 'x86_64-apple-darwin',
    'darwin-arm64': 'aarch64-apple-darwin',
    'linux-x64': 'x86_64-unknown-linux-gnu',
    'linux-arm64': 'aarch64-unknown-linux-gnu'
  };
  
  const platformKey = `${platformInfo.platform}-${platformInfo.arch}`;
  const asciinemaTarget = platformMap[platformKey];
  
  if (!asciinemaTarget) {
    logger.error(`Unsupported platform: ${platformKey}`);
    return null;
  }
  
  const filename = `asciinema-${asciinemaTarget}`;
  const url = `https://github.com/asciinema/asciinema/releases/download/v${version}/${filename}`;
  
  try {
    // Check if this is a global installation
    const isGlobalInstall = process.env.npm_config_global === 'true' || 
                           process.env.npm_config_prefix || 
                           process.argv.includes('--global');
    
    // Choose installation directory based on installation type
    const binDir = isGlobalInstall ? '/usr/local/bin' : './.dg/bin';
    
    // Ensure directory exists
    await ensureDirectoryExists(binDir);
    
    // Download binary
    const binaryPath = join(binDir, 'asciinema');
    await downloadFile(url, binaryPath);
    
    // Make executable
    execSync(`chmod +x ${binaryPath}`, { stdio: 'pipe' });
    
    logger.info(`Downloaded asciinema to: ${binaryPath}`);
    return binaryPath;
  } catch (error) {
    logger.error('Failed to download asciinema:', error);
    return null;
  }
}

export function getAsciinemaPath(): string {
  // Enterprise escape hatch
  if (process.env.DG_GPL_OFF === '1') {
    return 'asciinema'; // Use PATH only
  }
  
  // Choose path based on installation type
  const binPath = join(process.cwd(), '.dg', 'bin', 'asciinema');
  
  if (existsSync(binPath)) {
    // Legal notice (shown once per session)
    if (!hasShownLegalNotice()) {
      console.log('ℹ️  DG uses asciinema (GPL-3.0) via bundled binary');
      markLegalNoticeShown();
    }
    return binPath;
  }
  
  // Fallback to PATH
  return 'asciinema';
}

export async function checkAsciinemaAvailability(): Promise<{
  available: boolean;
  version?: string;
  path: string;
  source: 'bundled' | 'path' | 'none';
}> {
  const asciinemaPath = getAsciinemaPath();
  
  try {
    const output = execSync(`"${asciinemaPath}" --version`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const version = output.trim();
    const source = asciinemaPath.includes('node_modules') ? 'bundled' : 'path';
    
    return {
      available: true,
      version,
      path: asciinemaPath,
      source
    };
  } catch (error) {
    return {
      available: false,
      path: asciinemaPath,
      source: 'none'
    };
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
  const asciinemaPath = getAsciinemaPath();
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
    BASH_COMPLETION_USER_DIR: '/dev/null',
    // Asciinema specific
    ASCIINEMA_REC: '1'
  };
  
  try {
    const args = [
      'rec',
      outputPath,
      '--overwrite',
      '--cols', cols.toString(),
      '--rows', rows.toString(),
      '--env', 'COLUMNS,LINES,TERM,LANG,LC_ALL,PS1,RPROMPT,RPS1,ZLE_RPROMPT_INDENT'
    ];
    
    // Import node-pty
    const pty = await import('node-pty');

    // Create a PTY instance with proper configuration
    const ptyProcess = pty.spawn(asciinemaPath, args, {
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
      console.log('💡 asciinema not found. Install it:');
      console.log('   macOS: brew install asciinema');
      console.log('   Ubuntu: apt-get install asciinema');
      console.log('   Or visit: https://docs.asciinema.org/manual/cli/installation/');
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
      console.log('   1. Test: asciinema --version');
      console.log('   2. Check terminal compatibility');
      console.log('   3. Try recording manually: asciinema rec test.cast');
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
  const asciinemaPath = getAsciinemaPath();
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
    const args = [
      `"${asciinemaPath}"`,
      'rec',
      `"${outputPath}"`,
      '--overwrite',
      '--cols', cols.toString(),
      '--rows', rows.toString(),
      '--env', 'COLUMNS,LINES,TERM'
    ];
    
    args.push('-c', `"${command}"`);
    
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
      console.log('💡 asciinema not found. Install it:');
      console.log('   macOS: brew install asciinema');
      console.log('   Ubuntu: apt-get install asciinema');
      console.log('   Or visit: https://docs.asciinema.org/manual/cli/installation/');
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
      console.log('   1. Test: asciinema --version');
      console.log('   2. Check terminal compatibility');
      console.log('   3. Try recording manually: asciinema rec test.cast');
    }
    
    return false;
  }
}

export async function installAsciinemaInteractive(): Promise<boolean> {
  const currentPlatform = process.platform;
  
  console.log('\n🔧 asciinema not found. Installing...\n');
  
  try {
    switch (currentPlatform) {
      case 'darwin':
        console.log('📦 Attempting to install via Homebrew...');
        try {
          execSync('brew --version', { stdio: 'pipe' });
          execSync('brew install asciinema', { stdio: 'inherit' });
          console.log('✅ asciinema installed successfully!');
          return true;
        } catch (brewError) {
          console.log('❌ Homebrew not available or installation failed');
          console.log('💡 Please install manually:');
          console.log('   brew install asciinema');
          console.log('   Or visit: https://docs.asciinema.org/manual/cli/installation/');
          return false;
        }
        
      case 'linux':
        console.log('📦 Attempting to install via install script...');
        try {
          const isGlobalInstall = process.env.npm_config_global === 'true' || 
                                 process.env.npm_config_prefix || 
                                 process.argv.includes('--global');
          
          const installCommand = isGlobalInstall 
            ? 'curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-asciinema.sh | sudo -E bash -'
            : 'curl -sL https://raw.githubusercontent.com/DeepGuide-Ai/dg/master/scripts/install-asciinema.sh | bash -';
          execSync(installCommand, { stdio: 'inherit' });
          console.log('✅ asciinema installed successfully!');
          return true;
        } catch (installError) {
          console.log('❌ Install script failed');
          console.log('💡 Please install manually:');
          console.log('   Ubuntu/Debian: sudo apt-get install asciinema');
          console.log('   CentOS/RHEL: sudo yum install asciinema');
          console.log('   Or visit: https://docs.asciinema.org/manual/cli/installation/');
          return false;
        }
        
      default:
        console.log('❌ Automatic installation not supported on this platform');
        console.log('\n💡 Please install manually:');
        console.log('   Visit: https://docs.asciinema.org/manual/cli/installation/');
        return false;
    }
  } catch (error) {
    console.log('❌ Installation failed:', (error as Error).message);
    console.log('\n💡 Please install manually:');
    console.log('   Visit: https://docs.asciinema.org/manual/cli/installation/');
    return false;
  }
} 