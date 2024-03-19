import React, {memo, useMemo} from 'react'
import {StyleSheet, View} from 'react-native'
import {
  AtUri,
  AppBskyFeedDefs,
  AppBskyFeedPost,
  RichText as RichTextAPI,
  ModerationDecision,
} from '@atproto/api'
import {moderatePost_wrapped as moderatePost} from '#/lib/moderatePost_wrapped'
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome'
import {PostThreadFollowBtn} from 'view/com/post-thread/PostThreadFollowBtn'
import {Link, TextLink} from '../util/Link'
import {RichText} from '#/components/RichText'
import {Text} from '../util/text/Text'
import {PreviewableUserAvatar} from '../util/UserAvatar'
import {s} from 'lib/styles'
import {niceDate} from 'lib/strings/time'
import {sanitizeDisplayName} from 'lib/strings/display-names'
import {sanitizeHandle} from 'lib/strings/handles'
import {countLines} from 'lib/strings/helpers'
import {getTranslatorLink, isPostInLanguage} from '../../../locale/helpers'
import {PostMeta} from '../util/PostMeta'
import {PostEmbeds} from '../util/post-embeds'
import {PostCtrls} from '../util/post-ctrls/PostCtrls'
import {PostHider} from '../../../components/moderation/PostHider'
import {ContentHider} from '../../../components/moderation/ContentHider'
import {PostAlerts} from '../../../components/moderation/PostAlerts'
import {LabelsOnMyPost} from '../../../components/moderation/LabelsOnMe'
import {ErrorMessage} from '../util/error/ErrorMessage'
import {usePalette} from 'lib/hooks/usePalette'
import {formatCount} from '../util/numeric/format'
import {makeProfileLink} from 'lib/routes/links'
import {useWebMediaQueries} from 'lib/hooks/useWebMediaQueries'
import {MAX_POST_LINES} from 'lib/constants'
import {Trans, msg, Plural} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useLanguagePrefs} from '#/state/preferences'
import {useComposerControls} from '#/state/shell/composer'
import {useModerationOpts} from '#/state/queries/preferences'
import {useOpenLink} from '#/state/preferences/in-app-browser'
import {Shadow, usePostShadow, POST_TOMBSTONE} from '#/state/cache/post-shadow'
import {ThreadPost} from '#/state/queries/post-thread'
import {useSession} from 'state/session'
import {WhoCanReply} from '../threadgate/WhoCanReply'
import {LoadingPlaceholder} from '../util/LoadingPlaceholder'
import {atoms as a} from '#/alf'

export function PostThreadItem({
  post,
  record,
  treeView,
  depth,
  prevPost,
  nextPost,
  isHighlightedPost,
  hasMore,
  showChildReplyLine,
  showParentReplyLine,
  hasPrecedingItem,
  onPostReply,
}: {
  post: AppBskyFeedDefs.PostView
  record: AppBskyFeedPost.Record
  treeView: boolean
  depth: number
  prevPost: ThreadPost | undefined
  nextPost: ThreadPost | undefined
  isHighlightedPost?: boolean
  hasMore?: boolean
  showChildReplyLine?: boolean
  showParentReplyLine?: boolean
  hasPrecedingItem: boolean
  onPostReply: () => void
}) {
  const moderationOpts = useModerationOpts()
  const postShadowed = usePostShadow(post)
  const richText = useMemo(
    () =>
      new RichTextAPI({
        text: record.text,
        facets: record.facets,
      }),
    [record],
  )
  const moderation = useMemo(
    () =>
      post && moderationOpts ? moderatePost(post, moderationOpts) : undefined,
    [post, moderationOpts],
  )
  if (postShadowed === POST_TOMBSTONE) {
    return <PostThreadItemDeleted />
  }
  if (richText && moderation) {
    return (
      <PostThreadItemLoaded
        // Safeguard from clobbering per-post state below:
        key={postShadowed.uri}
        post={postShadowed}
        prevPost={prevPost}
        nextPost={nextPost}
        record={record}
        richText={richText}
        moderation={moderation}
        treeView={treeView}
        depth={depth}
        isHighlightedPost={isHighlightedPost}
        hasMore={hasMore}
        showChildReplyLine={showChildReplyLine}
        showParentReplyLine={showParentReplyLine}
        hasPrecedingItem={hasPrecedingItem}
        onPostReply={onPostReply}
      />
    )
  }
  return null
}

function PostThreadItemDeleted() {
  const pal = usePalette('default')
  return (
    <View style={[styles.outer, pal.border, pal.view, s.p20, s.flexRow]}>
      <FontAwesomeIcon icon={['far', 'trash-can']} color={pal.colors.icon} />
      <Text style={[pal.textLight, s.ml10]}>
        <Trans>This post has been deleted.</Trans>
      </Text>
    </View>
  )
}

let PostThreadItemLoaded = ({
  post,
  record,
  richText,
  moderation,
  treeView,
  depth,
  prevPost,
  nextPost,
  isHighlightedPost,
  hasMore,
  showChildReplyLine,
  showParentReplyLine,
  hasPrecedingItem,
  onPostReply,
}: {
  post: Shadow<AppBskyFeedDefs.PostView>
  record: AppBskyFeedPost.Record
  richText: RichTextAPI
  moderation: ModerationDecision
  treeView: boolean
  depth: number
  prevPost: ThreadPost | undefined
  nextPost: ThreadPost | undefined
  isHighlightedPost?: boolean
  hasMore?: boolean
  showChildReplyLine?: boolean
  showParentReplyLine?: boolean
  hasPrecedingItem: boolean
  onPostReply: () => void
}): React.ReactNode => {
  const pal = usePalette('default')
  const {_} = useLingui()
  const langPrefs = useLanguagePrefs()
  const {openComposer} = useComposerControls()
  const [limitLines, setLimitLines] = React.useState(
    () => countLines(richText?.text) >= MAX_POST_LINES,
  )
  const {currentAccount} = useSession()
  const rootUri = record.reply?.root?.uri || post.uri
  const postHref = React.useMemo(() => {
    const urip = new AtUri(post.uri)
    return makeProfileLink(post.author, 'post', urip.rkey)
  }, [post.uri, post.author])
  const itemTitle = _(msg`Post by ${post.author.handle}`)
  const authorHref = makeProfileLink(post.author)
  const authorTitle = post.author.handle
  const likesHref = React.useMemo(() => {
    const urip = new AtUri(post.uri)
    return makeProfileLink(post.author, 'post', urip.rkey, 'liked-by')
  }, [post.uri, post.author])
  const likesTitle = _(msg`Likes on this post`)
  const repostsHref = React.useMemo(() => {
    const urip = new AtUri(post.uri)
    return makeProfileLink(post.author, 'post', urip.rkey, 'reposted-by')
  }, [post.uri, post.author])
  const repostsTitle = _(msg`Reposts of this post`)

  const translatorUrl = getTranslatorLink(
    record?.text || '',
    langPrefs.primaryLanguage,
  )
  const needsTranslation = useMemo(
    () =>
      Boolean(
        langPrefs.primaryLanguage &&
          !isPostInLanguage(post, [langPrefs.primaryLanguage]),
      ),
    [post, langPrefs.primaryLanguage],
  )

  const onPressReply = React.useCallback(() => {
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: record.text,
        author: {
          handle: post.author.handle,
          displayName: post.author.displayName,
          avatar: post.author.avatar,
        },
        embed: post.embed,
        moderation,
      },
      onPost: onPostReply,
    })
  }, [openComposer, post, record, onPostReply, moderation])

  const onPressShowMore = React.useCallback(() => {
    setLimitLines(false)
  }, [setLimitLines])

  if (!record) {
    return <ErrorMessage message={_(msg`Invalid or unsupported post record`)} />
  }

  if (isHighlightedPost) {
    return (
      <>
        {rootUri !== post.uri && (
          <View style={{paddingLeft: 16, flexDirection: 'row', height: 16}}>
            <View style={{width: 38}}>
              <View
                style={[
                  styles.replyLine,
                  {
                    flexGrow: 1,
                    backgroundColor: pal.colors.border,
                  },
                ]}
              />
            </View>
          </View>
        )}

        <View
          testID={`postThreadItem-by-${post.author.handle}`}
          style={[styles.outer, styles.outerHighlighted, pal.border, pal.view]}
          accessible={false}>
          <View style={[styles.layout]}>
            <View style={[styles.layoutAvi, {paddingBottom: 8}]}>
              <PreviewableUserAvatar
                size={42}
                did={post.author.did}
                handle={post.author.handle}
                avatar={post.author.avatar}
                moderation={moderation.ui('avatar')}
              />
            </View>
            <View style={styles.layoutContent}>
              <View
                style={[styles.meta, styles.metaExpandedLine1, {zIndex: 1}]}>
                <Link style={s.flex1} href={authorHref} title={authorTitle}>
                  <Text
                    type="xl-bold"
                    style={[pal.text]}
                    numberOfLines={1}
                    lineHeight={1.2}>
                    {sanitizeDisplayName(
                      post.author.displayName ||
                        sanitizeHandle(post.author.handle),
                      moderation.ui('displayName'),
                    )}
                  </Text>
                </Link>
              </View>
              <View style={styles.meta}>
                <Link style={s.flex1} href={authorHref} title={authorTitle}>
                  <Text type="md" style={[pal.textLight]} numberOfLines={1}>
                    {sanitizeHandle(post.author.handle, '@')}
                  </Text>
                </Link>
              </View>
            </View>
            {currentAccount?.did !== post.author.did && (
              <PostThreadFollowBtn did={post.author.did} />
            )}
          </View>
          <View style={[s.pl10, s.pr10, s.pb10]}>
            <LabelsOnMyPost post={post} />
            <ContentHider
              modui={moderation.ui('contentView')}
              ignoreMute
              style={styles.contentHider}
              childContainerStyle={styles.contentHiderChild}>
              <PostAlerts
                modui={moderation.ui('contentView')}
                includeMute
                style={[a.pt_2xs, a.pb_sm]}
              />
              {richText?.text ? (
                <View
                  style={[
                    styles.postTextContainer,
                    styles.postTextLargeContainer,
                  ]}>
                  <RichText
                    enableTags
                    selectable
                    value={richText}
                    style={[a.flex_1, a.text_xl]}
                    authorHandle={post.author.handle}
                  />
                </View>
              ) : undefined}
              {post.embed && (
                <View style={[a.pb_sm]}>
                  <PostEmbeds embed={post.embed} moderation={moderation} />
                </View>
              )}
            </ContentHider>
            <ExpandedPostDetails
              post={post}
              translatorUrl={translatorUrl}
              needsTranslation={needsTranslation}
            />
            {post.repostCount !== 0 || post.likeCount !== 0 ? (
              // Show this section unless we're *sure* it has no engagement.
              <View style={[styles.expandedInfo, pal.border]}>
                {post.repostCount == null && post.likeCount == null && (
                  // If we're still loading and not sure, assume this post has engagement.
                  // This lets us avoid a layout shift for the common case (embedded post with likes/reposts).
                  // TODO: embeds should include metrics to avoid us having to guess.
                  <LoadingPlaceholder width={50} height={20} />
                )}
                {post.repostCount != null && post.repostCount !== 0 ? (
                  <Link
                    style={styles.expandedInfoItem}
                    href={repostsHref}
                    title={repostsTitle}>
                    <Text
                      testID="repostCount-expanded"
                      type="lg"
                      style={pal.textLight}>
                      <Text type="xl-bold" style={pal.text}>
                        {formatCount(post.repostCount)}
                      </Text>{' '}
                      <Plural
                        value={post.repostCount}
                        one="repost"
                        other="reposts"
                      />
                    </Text>
                  </Link>
                ) : null}
                {post.likeCount != null && post.likeCount !== 0 ? (
                  <Link
                    style={styles.expandedInfoItem}
                    href={likesHref}
                    title={likesTitle}>
                    <Text
                      testID="likeCount-expanded"
                      type="lg"
                      style={pal.textLight}>
                      <Text type="xl-bold" style={pal.text}>
                        {formatCount(post.likeCount)}
                      </Text>{' '}
                      <Plural value={post.likeCount} one="like" other="likes" />
                    </Text>
                  </Link>
                ) : null}
              </View>
            ) : null}
            <View style={[s.pl10, s.pr10, s.pb5]}>
              <PostCtrls
                big
                post={post}
                record={record}
                richText={richText}
                onPressReply={onPressReply}
                logContext="PostThreadItem"
              />
            </View>
          </View>
        </View>
        <WhoCanReply post={post} />
      </>
    )
  } else {
    const isThreadedChild = treeView && depth > 0
    const isThreadedChildAdjacentTop =
      isThreadedChild && prevPost?.ctx.depth === depth && depth !== 1
    const isThreadedChildAdjacentBot =
      isThreadedChild && nextPost?.ctx.depth === depth
    return (
      <>
        <PostOuterWrapper
          post={post}
          depth={depth}
          showParentReplyLine={!!showParentReplyLine}
          treeView={treeView}
          hasPrecedingItem={hasPrecedingItem}>
          <PostHider
            testID={`postThreadItem-by-${post.author.handle}`}
            href={postHref}
            style={[pal.view]}
            modui={moderation.ui('contentList')}
            iconSize={isThreadedChild ? 26 : 38}
            iconStyles={
              isThreadedChild
                ? {marginRight: 4}
                : {marginLeft: 2, marginRight: 2}
            }>
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                paddingLeft: 8,
                height: isThreadedChildAdjacentTop ? 8 : 16,
              }}>
              <View style={{width: 38}}>
                {!isThreadedChild && showParentReplyLine && (
                  <View
                    style={[
                      styles.replyLine,
                      {
                        flexGrow: 1,
                        backgroundColor: pal.colors.replyLine,
                        marginBottom: 4,
                      },
                    ]}
                  />
                )}
              </View>
            </View>

            <View
              style={[
                styles.layout,
                {
                  paddingBottom:
                    showChildReplyLine && !isThreadedChild
                      ? 0
                      : isThreadedChildAdjacentBot
                      ? 4
                      : 8,
                },
              ]}>
              {/* If we are in threaded mode, the avatar is rendered in PostMeta */}
              {!isThreadedChild && (
                <View style={styles.layoutAvi}>
                  <PreviewableUserAvatar
                    size={38}
                    did={post.author.did}
                    handle={post.author.handle}
                    avatar={post.author.avatar}
                    moderation={moderation.ui('avatar')}
                  />

                  {showChildReplyLine && (
                    <View
                      style={[
                        styles.replyLine,
                        {
                          flexGrow: 1,
                          backgroundColor: pal.colors.replyLine,
                          marginTop: 4,
                        },
                      ]}
                    />
                  )}
                </View>
              )}

              <View
                style={
                  isThreadedChild
                    ? styles.layoutContentThreaded
                    : styles.layoutContent
                }>
                <PostMeta
                  author={post.author}
                  moderation={moderation}
                  authorHasWarning={!!post.author.labels?.length}
                  timestamp={post.indexedAt}
                  postHref={postHref}
                  showAvatar={isThreadedChild}
                  avatarModeration={moderation.ui('avatar')}
                  avatarSize={28}
                  displayNameType="md-bold"
                  displayNameStyle={isThreadedChild && s.ml2}
                  style={isThreadedChild && s.mb2}
                />
                <LabelsOnMyPost post={post} />
                <PostAlerts
                  modui={moderation.ui('contentList')}
                  style={[a.pt_xs, a.pb_sm]}
                />
                {richText?.text ? (
                  <View style={styles.postTextContainer}>
                    <RichText
                      enableTags
                      value={richText}
                      style={[a.flex_1, a.text_md]}
                      numberOfLines={limitLines ? MAX_POST_LINES : undefined}
                      authorHandle={post.author.handle}
                    />
                  </View>
                ) : undefined}
                {limitLines ? (
                  <TextLink
                    text={_(msg`Show More`)}
                    style={pal.link}
                    onPress={onPressShowMore}
                    href="#"
                  />
                ) : undefined}
                {post.embed && (
                  <View style={[a.pb_xs]}>
                    <PostEmbeds embed={post.embed} moderation={moderation} />
                  </View>
                )}
                <PostCtrls
                  post={post}
                  record={record}
                  richText={richText}
                  onPressReply={onPressReply}
                  logContext="PostThreadItem"
                />
              </View>
            </View>
            {hasMore ? (
              <Link
                style={[
                  styles.loadMore,
                  {
                    paddingLeft: treeView ? 8 : 70,
                    paddingTop: 0,
                    paddingBottom: treeView ? 4 : 12,
                  },
                ]}
                href={postHref}
                title={itemTitle}
                noFeedback>
                <Text type="sm-medium" style={pal.textLight}>
                  More
                </Text>
                <FontAwesomeIcon
                  icon="angle-right"
                  color={pal.colors.textLight}
                  size={14}
                />
              </Link>
            ) : undefined}
          </PostHider>
        </PostOuterWrapper>
        <WhoCanReply
          post={post}
          style={{
            marginTop: 4,
          }}
        />
      </>
    )
  }
}
PostThreadItemLoaded = memo(PostThreadItemLoaded)

function PostOuterWrapper({
  post,
  treeView,
  depth,
  showParentReplyLine,
  hasPrecedingItem,
  children,
}: React.PropsWithChildren<{
  post: AppBskyFeedDefs.PostView
  treeView: boolean
  depth: number
  showParentReplyLine: boolean
  hasPrecedingItem: boolean
}>) {
  const {isMobile} = useWebMediaQueries()
  const pal = usePalette('default')
  if (treeView && depth > 0) {
    return (
      <View
        style={[
          pal.border,
          styles.cursor,
          {
            flexDirection: 'row',
            paddingHorizontal: isMobile ? 10 : 6,
            borderTopWidth: depth === 1 ? 1 : 0,
          },
        ]}>
        {Array.from(Array(depth - 1)).map((_, n: number) => (
          <View
            key={`${post.uri}-padding-${n}`}
            style={{
              borderLeftWidth: 2,
              borderLeftColor: pal.colors.border,
              marginLeft: isMobile ? 6 : 12,
              paddingLeft: isMobile ? 6 : 8,
            }}
          />
        ))}
        <View style={{flex: 1}}>{children}</View>
      </View>
    )
  }
  return (
    <View
      style={[
        styles.outer,
        pal.border,
        showParentReplyLine && hasPrecedingItem && styles.noTopBorder,
        styles.cursor,
      ]}>
      {children}
    </View>
  )
}

function ExpandedPostDetails({
  post,
  needsTranslation,
  translatorUrl,
}: {
  post: AppBskyFeedDefs.PostView
  needsTranslation: boolean
  translatorUrl: string
}) {
  const pal = usePalette('default')
  const {_} = useLingui()
  const openLink = useOpenLink()
  const onTranslatePress = React.useCallback(
    () => openLink(translatorUrl),
    [openLink, translatorUrl],
  )
  return (
    <View style={[s.flexRow, s.mt2, s.mb10]}>
      <Text style={pal.textLight}>{niceDate(post.indexedAt)}</Text>
      {needsTranslation && (
        <>
          <Text style={pal.textLight}> &middot; </Text>
          <Text
            style={pal.link}
            title={_(msg`Translate`)}
            onPress={onTranslatePress}>
            <Trans>Translate</Trans>
          </Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    borderTopWidth: 1,
    paddingLeft: 8,
  },
  outerHighlighted: {
    paddingTop: 16,
    paddingLeft: 8,
    paddingRight: 8,
  },
  noTopBorder: {
    borderTopWidth: 0,
  },
  layout: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  layoutAvi: {},
  layoutContent: {
    flex: 1,
    marginLeft: 10,
  },
  layoutContentThreaded: {
    flex: 1,
    paddingRight: 10,
  },
  meta: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  metaExpandedLine1: {
    paddingVertical: 0,
  },
  alert: {
    marginBottom: 6,
  },
  postTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingBottom: 4,
    paddingRight: 10,
  },
  postTextLargeContainer: {
    paddingHorizontal: 0,
    paddingRight: 0,
    paddingBottom: 10,
  },
  translateLink: {
    marginBottom: 6,
  },
  contentHider: {
    marginBottom: 6,
  },
  contentHiderChild: {
    marginTop: 6,
  },
  expandedInfo: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 5,
    marginBottom: 15,
  },
  expandedInfoItem: {
    marginRight: 10,
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingHorizontal: 20,
  },
  replyLine: {
    width: 2,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  cursor: {
    // @ts-ignore web only
    cursor: 'pointer',
  },
})
