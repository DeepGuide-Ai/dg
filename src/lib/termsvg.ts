import { execSync } from 'child_process';
import { platform, arch } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';
import type { PlatformInfo } from '../types.js';

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
  // First try system termsvg
  try {
    const versionOutput = execSync('termsvg --help', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Try to get version from help output or version command
    let version = 'unknown';
    try {
      const versionCheck = execSync('termsvg --version', { 
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
    
    // Try to get the path
    let termsvgPath = 'termsvg';
    try {
      const whichOutput = execSync(platform() === 'win32' ? 'where termsvg' : 'which termsvg', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      termsvgPath = whichOutput.trim().split('\n')[0];
    } catch {
      // Keep default if which/where fails
    }
    
    return {
      available: true,
      version,
      path: termsvgPath,
      supportsRecording
    };
  } catch (error) {
    // System termsvg not available, try local binary
    try {
      const localPath = join(process.cwd(), '.dg', 'bin', 'termsvg');
      if (existsSync(localPath)) {
        const versionOutput = execSync(`${localPath} --help`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        // Try to get version
        let version = 'unknown';
        try {
          const versionCheck = execSync(`${localPath} --version`, { 
            encoding: 'utf8',
            stdio: 'pipe'
          });
          version = versionCheck.trim();
        } catch {
          const versionMatch = versionOutput.match(/termsvg\s+v?(\d+\.\d+\.\d+)/i);
          if (versionMatch) {
            version = versionMatch[1];
          }
        }
        
        const supportsRecording = versionOutput.includes('rec') && platform() !== 'win32';
        
        return {
          available: true,
          version,
          path: localPath,
          supportsRecording
        };
      }
    } catch (localError) {
      // Local binary also not available
    }
    
    return {
      available: false,
      supportsRecording: false,
      installCommand: getTermSVGInstallCommand(),
      installInstructions: getTermSVGInstallInstructions()
    };
  }
}



export async function installTermSVGInteractive(): Promise<boolean> {
  const currentPlatform = platform();
  
  console.log('\n🔧 termsvg not found. Installing...\n');
  
  try {
    switch (currentPlatform) {
      case 'darwin':
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