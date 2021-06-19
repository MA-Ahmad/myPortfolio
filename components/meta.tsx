import Head from 'next/head'

const Meta = ({ title, keywords, description }) => {
    return (
        <Head>
            <meta name='viewport' content='width=device-width, initial-scale=1' />
            <meta property="og:title" content="Muhammad Ahmad - Full Stack Developer" />
            {/* <meta property="og:image" content="%PUBLIC_URL%/logo512.png" /> */}
            <meta name='keywords' content={keywords} />
            <meta name='description' content={description} />
            <meta charSet='utf-8' />
            <link rel='icon' href='/favicon.ico' />
            <title>{title}</title>
        </Head>
    )
}

Meta.defaultProps = {
    title: 'Muhammad Ahmad - Full Stack Developer',
    keywords: 'web development, programming, web design',
    description: 'Software Engineer. Lover of web and opensource.',
}

export default Meta
