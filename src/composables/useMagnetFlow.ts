/** @fileoverview Pure utility functions for the magnet URI file selection flow.
 *
 * Extracted as pure functions for testability:
 * - Detect magnet URIs
 * - Build metadata-only aria2 options
 * - Parse aria2 file list into UI-friendly selection items
 * - Build the select-file option string
 */
import type { Aria2File, Aria2EngineOptions, Aria2Task } from '@shared/types'

/** Check if a URI is a magnet link. */
export function isMagnetUri(uri: string): boolean {
  return uri.toLowerCase().startsWith('magnet:')
}

/** Augment engine options to download metadata only (no actual files). */
export function buildMetadataOnlyOptions(baseOptions: Aria2EngineOptions): Aria2EngineOptions {
  return {
    ...baseOptions,
    'pause-metadata': 'true',
  }
}

/** A file entry parsed for the selection UI. */
export interface MagnetFileItem {
  index: number
  name: string
  path: string
  length: number
}

export type MagnetSelectionSubmission = 'confirm' | null

/** Convert raw Aria2File array into UI-friendly selection items. */
export function parseFilesForSelection(files: Aria2File[]): MagnetFileItem[] {
  return files.map((f) => {
    const parts = f.path.split(/[/\\]/)
    return {
      index: Number(f.index),
      name: parts[parts.length - 1],
      path: f.path,
      length: Number(f.length),
    }
  })
}

/** Build the aria2 select-file option string from selected indices. */
export function buildSelectFileOption(indices: number[]): string {
  if (indices.length === 0) return ''
  return [...indices].sort((a, b) => a - b).join(',')
}

export function isPendingMagnetSelectionTask(task: Aria2Task): boolean {
  return Boolean(task.bittorrent && task.status === 'paused' && task.bittorrent.state === 'awaitingFileSelection')
}

export function getPendingMagnetSelectionGids(tasks: Aria2Task[]): string[] {
  return tasks.filter(isPendingMagnetSelectionTask).map((task) => task.gid)
}

export function findPendingMagnetSelectionTask(tasks: Aria2Task[], gid: string): Aria2Task | undefined {
  return tasks.find((task) => isPendingMagnetSelectionTask(task) && task.gid === gid)
}

export interface MagnetSelectionResolution {
  gid: string
}
