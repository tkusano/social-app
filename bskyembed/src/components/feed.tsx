import {AppBskyFeedDefs} from '@atproto/api'
import {h} from 'preact'

import {Post} from '../components/post'

interface Props {
  feed: AppBskyFeedDefs.FeedViewPost[]
}

export function Feed({feed}: Props) {
  return (
    <div>
      {feed.map(item => (
        <Post thread={item} key={item.uri} />
      ))}
    </div>
  )
}
