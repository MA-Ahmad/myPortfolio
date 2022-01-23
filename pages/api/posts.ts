import prisma from "lib/prisma"
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const posts = await prisma.post.findMany({
      where: {
        likes: {
          not: 0
        },
      }
    })
    res.json({ dbPosts: posts })
    return
  } catch (err: any) {
    res.status(500).json({
      statusCode: 500,
      message: err.message,
    })
  }
}
