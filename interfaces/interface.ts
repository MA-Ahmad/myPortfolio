export interface IArticle {
    id?: number
    title: string
    description: string
    coverImage?: string
    tags: string[]
    tag_list?: string[]
    publishedAt: string
    devToSlug?: string
    devToPath?: string
    devToURL?: string
    commentsCount?: number
    publicReactionsCount?: number
    positiveReactionsCount?: number
    canonical?: string
    collectionId?: number
    readingTime?: number
    slug: string
    markdown?: string
    html?: string
}

export interface BlogPost {
    id: number
    title: string
    description: string
    type_of: string
    canonical_url: string
    slug: string
    body_markdown: string
    tags: string[]
    tag_list: string[]
    comments_count: number
    cover_image: string
    path: string
    positive_reactions_count: number
    public_reactions_count: number
    published: boolean
    published_at: string
    published_timestamp: string
    url: string
    readable_publish_date: string
    collection_id: null | number
    social_image: string
    created_at: string
    edited_at: string | null
    crossposted_at: null | string
    last_comment_at: string
    body_html: string
  }