type Size = { width: number; height: number } | undefined
export function coverFrame(design?: string | null, size?: Size): string
export function fitsFrame(size: Size, frame: string): boolean
export function frameFor(frame: string, size: Size): string
export function coverSizes(design: string | null | undefined, inBand: boolean): string
export function croppedSizesFor(sizes: string, size: { width: number; height: number } | undefined, frameRatio?: number): string
