import prisma from 'lib/prisma';
import { createHash } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ipAddress =
      req.headers['x-forwarded-for'] ||
      // Fallback for localhost or non Vercel deployments
      '0.0.0.0';

    const postId = req.query.id as string;
    const currentUserId =
      // Since a users IP address is part of the sessionId in our database, we
      // hash it to protect their privacy. By combining it with a salt, we get
      // get a unique id we can refer to, but we won't know what their ip
      // address was.
      createHash('md5')
        .update(ipAddress + process.env.IP_ADDRESS_HASH, 'utf8')
        .digest('hex');

    // Identify a specific users interactions with a specific post
    const sessionId = postId + '___' + currentUserId;

    switch (req.method) {
      case 'GET': {
        const [post, user] = await Promise.all([
          // get the number of likes this post has
          prisma.post.findUnique({
            where: { slug: postId }
          }),

          // get the number of times the current user has liked this post
          prisma.session.findUnique({
            where: { id: sessionId }
          })
        ]);

        res.json({
          totalPostLikes: post?.likes || 0,
          totalPostViews: post?.views || 0,
          currentUserLikes: user?.likes || 0
        });
        return;
      }

      case 'POST': {
        const count = z.number().min(1).max(3).parse(req.body.count);
        const title = req.body.title;

        if (req.body.type === 'views') {
          // increment the number of times everyone has viewed this post
          const post = await prisma.post.upsert({
            where: { slug: postId },
            create: {
              slug: postId,
              views: count,
              title: title
            },
            update: {
              views: {
                increment: count
              }
            }
          });

          res.json({
            totalPostLikes: post?.likes || 0,
            totalPostViews: post?.views || 0
          });
        } else {
          // Upsert: if a row exists, update it by incrementing likes. If it
          // doesn't exist, create a new row with the number of likes this api
          // route receives
          const [post, user] = await Promise.all([
            // increment the number of times everyone has liked this post
            prisma.post.upsert({
              where: { slug: postId },
              create: {
                slug: postId,
                title: title,
                likes: count
              },
              update: {
                likes: {
                  increment: count
                }
              }
            }),

            // increment the number of times this user has liked this post
            prisma.session.upsert({
              where: { id: sessionId },
              create: {
                id: sessionId,
                likes: count
              },
              update: {
                likes: {
                  increment: count
                }
              }
            })
          ]);

          res.json({
            totalPostLikes: post?.likes || 0,
            totalPostViews: post?.views || 0,
            currentUserLikes: user?.likes || 0
          });
        }

        return;
      }
    }
  } catch (err) {
    res.status(500).json({
      statusCode: 500,
      message: err.message
    });
  }
}
