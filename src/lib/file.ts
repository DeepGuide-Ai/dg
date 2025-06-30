import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dgLogger as logger } from './logger.js';
import { dirname } from 'path';

export async function ensureDirectoryExists(dirPath: string): Promise<boolean> {
  try {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
    return true;
  } catch (error) {
    logger.error('Failed to create directory:', error);
    return false;
  }
}

export async function downloadFile(url: string, targetPath: string): Promise<boolean> {
  try {
    // Ensure target directory exists
    await ensureDirectoryExists(dirname(targetPath));
    
    // Download file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Write to file
    const buffer = await response.arrayBuffer();
    const { writeFile } = await import('fs/promises');
    await writeFile(targetPath, new Uint8Array(buffer));
    
    return true;
  } catch (error) {
    logger.error('Failed to download file:', error);
    return false;
  }
}

export function safeDeleteExistingCast(filePath: string): boolean {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    logger.error('Failed to delete existing cast:', error);
    return false;
  }
}
