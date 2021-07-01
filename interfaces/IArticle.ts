interface IArticle {
    id: number
    title: string
    description: string
    coverImage: string
    tags: string[]
    publishedAt: string
    devToSlug: string
    devToPath: string
    devToURL: string
    commentsCount: number
    publicReactionsCount: number
    positiveReactionsCount: number
    canonical: string
    collectionId: number
    readingTime?: number
    slug: string
    markdown: string
    html: string
}

export default IArticle
