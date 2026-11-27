import type { ReactNode } from 'react'
import { savedPage } from '#/lib/page-layouts'
import { freeBlocks } from './free-blocks'
import * as pageBlocks from './page-blocks'

// A website page drawn from its published visual-editor layout (content/layouts/page-<key>.json):
// its sections in order with their settings, and any blocks of your own. A page with no saved
// layout shows its standard sections, exactly as before. Visitors never load the editor.

const blocks: Record<string, (props: Record<string, unknown>) => ReactNode> = {
  HomeIntro: pageBlocks.HomeIntro as never,
  HomeClock: pageBlocks.HomeClock as never,
  HomeLine: pageBlocks.HomeLine as never,
  HomeFocus: pageBlocks.HomeFocus as never,
  HomeWork: pageBlocks.HomeWork as never,
  AboutHero: pageBlocks.AboutHero as never,
  AboutIntro: pageBlocks.AboutIntro as never,
  AboutSkills: pageBlocks.AboutSkills as never,
  AboutEducation: pageBlocks.AboutEducation as never,
  AboutExperience: pageBlocks.AboutExperience as never,
  ListingHead: pageBlocks.ListingHead as never,
  ListingBands: pageBlocks.ListingBands as never,
  ...freeBlocks,
}

export function PageSections({ page, standard, category }: { page: string; standard: readonly string[]; category?: string }) {
  const items = savedPage(page)?.content ?? standard.map((type) => ({ type, props: { id: `${type}-standard` } }))
  return items.map((item) => {
    const Block = blocks[item.type]
    return Block ? <Block key={item.props.id} {...item.props} category={category} /> : null
  })
}
