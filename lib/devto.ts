import axios, { AxiosResponse } from 'axios';
import IArticle from '../interfaces/IArticle';

const username = 'm_ahmad'

// Get all users articles from Dev.to and filter by ones with a canonical URL to your blog
export const getAllArticles = async (): Promise<IArticle[]> => {
    const params = { username, per_page: 1000 }
    const headers = { 'api-key': process.env.DEVTO_APIKEY }

    const { data }: AxiosResponse = await axios.get(`https://dev.to/api/articles/me`, {
        params,
        headers,
    })
    const articles: IArticle[] = data.map(convertDevtoResponseToArticle)
    return articles
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
const convertDevtoResponseToArticle = (data: any): IArticle => {
    const article: IArticle = {
        id: data.id,
        title: data.title,
        description: data.description,
        publishedAt: data.published_at,
        devToSlug: data.slug,
        devToPath: data.path,
        devToURL: data.url,
        commentsCount: data.comments_count,
        publicReactionsCount: data.public_reactions_count,
        positiveReactionsCount: data.positive_reactions_count,
        coverImage: data.cover_image,
        tags: data.tag_list,
        canonical: data.canonical_url,
        collectionId: data.collection_id || -1,
    }
    return article
}