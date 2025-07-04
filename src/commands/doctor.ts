import * as p from '@clack/prompts';
import { execSync, exec } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { checkAsciinemaAvailability, getAsciinemaCompatibility, installAsciinemaInteractive } from '../lib/asciinema.js';
import { checkTermSVGAvailability, installTermSVGInteractive } from '../lib/termsvg.js';
import { readConfig, configExists } from '../lib/config.js';
import type { EnvironmentDiagnostics, DiagnosticResult } from '../types.js';

export async function doctorCommand(options?: any): Promise<void> {
  console.clear();
  
  p.intro('🩺 System Diagnostics');
  
  const diagnostics: EnvironmentDiagnostics = {
    asciinema: await checkAsciinema(),
    svgTerm: await checkTermSVG(),
    storage: await checkStorage(),
    platform: await checkPlatform()
  };
  
  displayDiagnostics(diagnostics, options?.verbose);
  
  // Check for major issues
  const hasErrors = Object.values(diagnostics).some(d => d.status === 'error');
  const hasWarnings = Object.values(diagnostics).some(d => d.status === 'warning');
  
  if (hasErrors) {
    const shouldAutoFix = await p.confirm({
      message: 'Critical issues detected. Attempt automatic fixes?',
      initialValue: true
    });
    
    if (shouldAutoFix) {
      await autoFix(diagnostics);
    }
  } else if (hasWarnings && options?.fix) {
    await autoFix(diagnostics);
  }
  
  // Provide next steps
  if (hasErrors || hasWarnings) {
    p.note(
      'Run `dg doctor --verbose` for detailed information\nRun `dg doctor --fix` to attempt automatic repairs',
      'Next steps'
    );
  }
  
  const overallStatus = hasErrors ? 'Issues detected 🔧' : hasWarnings ? 'Minor warnings ⚠️' : 'All systems operational ✅';
  p.outro(overallStatus);
}

async function checkAsciinema(): Promise<DiagnosticResult> {
  const availability = await checkAsciinemaAvailability();
  
  if (availability.available) {
    return {
      status: 'ok',
      message: `asciinema ${availability.version} (${availability.source})`,
      details: 'Terminal recording enabled'
    };
  } else {
    if (process.env.DG_GPL_OFF === '1') {
      return {
        status: 'warning',
        message: 'GPL mode disabled',
        details: 'Install asciinema manually or remove DG_GPL_OFF=1'
      };
    } else {
      return {
        status: 'error',
        message: 'asciinema not available',
        details: 'Install via homebrew/apt or enable bundled binaries'
      };
    }
  }
}

async function checkTermSVG(): Promise<DiagnosticResult> {
  const availability = await checkTermSVGAvailability();
  
  if (availability.available) {
    const recordingStatus = availability.supportsRecording ? 'recording + export' : 'export only';
    return {
      status: 'ok',
      message: `termsvg ${availability.version} (${recordingStatus})`,
      details: `SVG generation enabled - ${availability.path}`
    };
  } else {
    return {
      status: 'warning',
      message: 'termsvg not available',
      details: availability.installCommand || 'Install from: https://github.com/MrMarble/termsvg'
    };
  }
}

async function checkStorage(): Promise<DiagnosticResult> {
  if (!configExists()) {
    return {
      status: 'warning',
      message: 'DG not initialized',
      details: 'Run `dg init` to set up project'
    };
  }
  
  const config = readConfig();
  if (!config) {
    return {
      status: 'error',
      message: 'Invalid configuration',
      details: 'Config file corrupted or unreadable'
    };
  }
  
  const dgPath = join(process.cwd(), config.outputDir);
  if (!existsSync(dgPath)) {
    return {
      status: 'error',
      message: 'DG directory missing',
      details: `Expected: ${dgPath}`
    };
  }
  
  // Check storage size
  try {
    const svgPath = join(dgPath, 'svg');
    if (existsSync(svgPath)) {
      const size = calculateDirectorySize(svgPath);
      const sizeMB = Math.round(size / 1024 / 1024);
      
      if (sizeMB > 50) {
        return {
          status: 'warning',
          message: `Large asset directory (${sizeMB}MB)`,
          details: 'Consider Git LFS for assets over 50MB'
        };
      } else if (sizeMB > 20) {
        return {
          status: 'warning',
          message: `Growing asset directory (${sizeMB}MB)`,
          details: 'Monitor size, consider optimization'
        };
      }
    }
    
    return {
      status: 'ok',
      message: 'Storage configured correctly',
      details: `Output: ${config.outputDir}, Demos: ${config.casts.length}`
    };
  } catch {
    return {
      status: 'warning',
      message: 'Storage check failed',
      details: 'Unable to analyze directory size'
    };
  }
}

async function checkPlatform(): Promise<DiagnosticResult> {
  const platformInfo = getAsciinemaCompatibility();
  
  if (platformInfo.supported) {
    return {
      status: 'ok',
      message: `${platformInfo.platform}-${platformInfo.arch} (supported)`,
      details: 'Bundled binaries available'
    };
  } else {
    return {
      status: 'warning',
      message: `${platformInfo.platform}-${platformInfo.arch} (experimental)`,
      details: 'Fallback to system PATH required'
    };
  }
}

function calculateDirectorySize(dirPath: string): number {
  let totalSize = 0;
  
  try {
    const files = execSync(`find "${dirPath}" -type f`, { encoding: 'utf8' }).trim().split('\n');
    for (const file of files) {
      if (file && existsSync(file)) {
        totalSize += statSync(file).size;
      }
    }
  } catch {
    // Fallback for systems without find
    return 0;
  }
  
  return totalSize;
}

function displayDiagnostics(diagnostics: EnvironmentDiagnostics, verbose: boolean = false): void {
  console.log('\n🔍 System Status:\n');
  
  for (const [category, result] of Object.entries(diagnostics)) {
    const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    
    console.log(`${icon} ${categoryName}: ${result.message}`);
    
    if (verbose && result.details) {
      console.log(`   ${result.details}`);
    }
  }
  
  console.log('');
}

async function autoFix(diagnostics: EnvironmentDiagnostics): Promise<void> {
  const fixes: string[] = [];
  
  // Auto-fix asciinema installation
  if (diagnostics.asciinema.status === 'error') {
    console.log('\n🔧 Attempting to install asciinema...');
    
    // Try system package manager first
    const installed = await installAsciinemaInteractive();
    if (installed) {
      fixes.push('✅ asciinema installed via package manager');
    } else {
      // Fallback to bundled binary download
      // try {
      //   const { downloadAsciinema } = await import('../lib/asciinema.js');
      //   const binaryPath = await downloadAsciinema();
      //   if (binaryPath) {
      //     fixes.push('✅ asciinema downloaded successfully');
      //   } else {
      //     fixes.push('❌ asciinema installation failed - manual installation required');
      //   }
      // } catch (error) {
      //   console.log('❌ asciinema download failed:', (error as Error).message);
      //   fixes.push('❌ asciinema installation failed - manual installation required');
      // }
    }
  }

  // Auto-fix termsvg installation
  if (diagnostics.svgTerm.status === 'warning' && diagnostics.svgTerm.message.includes('not available')) {
    console.log('\n🔧 Attempting to install termsvg...');
    const installed = await installTermSVGInteractive();
    if (installed) {
      fixes.push('✅ termsvg installed successfully');
    } else {
      fixes.push('❌ termsvg installation failed - manual installation required');
    }
  }
  
  if (fixes.length > 0) {
    p.note(fixes.join('\n'), 'Auto-fixes applied');
  } else {
    p.note('No automatic fixes available for current issues', 'Manual intervention required');
  }
} 