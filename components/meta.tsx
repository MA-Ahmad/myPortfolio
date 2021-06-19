import Head from 'next/head'

const Meta = ({ title, keywords, description }) => {
    return (
        <Head>
            <meta name='viewport' content='width=device-width, initial-scale=1' />
            <meta charSet='utf-8' />
            <meta name='keywords' content={keywords} />
            <meta name='description' content={description} />
            {/* <link rel='icon' href='/favicon.ico' /> */}
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
