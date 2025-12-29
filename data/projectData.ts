// data/projectData.ts

import { Project } from 'interfaces/interface';

export const projectsList: Project[] = [
  {
    id: 1,
    slug: 'switchboard',
    title: 'SwitchBoard',
    imageLight: '/assets/images/projects/switchboard.png',
    blurHash: 'L4ADc400P*Zi4Tu1y;Qo00pH#YXl',
    site: 'https://app.dev.switchboardcloud.com.au/',
    description:
      'Easily integrate and automate data with your partners. Automatically connect to your partners for automated, flexible, and cost efficient supply chains, with end to end visibility',
    techStack: ['Express', 'Nodejs', 'PostgreSQL', 'Next', 'Javascript'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/Switchboard/Capture.PNG',
        '/assets/images/ProjectsImage/Switchboard/2.PNG',
        '/assets/images/ProjectsImage/Switchboard/4.PNG',
        '/assets/images/ProjectsImage/Switchboard/5.PNG'
      ],
      longDescription: [
        'SwitchBoard is a B2B integration platform that connects suppliers and retailers through automated data flows.',
        'I worked on both backend and frontend, including partner onboarding, connection management, and event tracking.'
      ],
      role: 'Full Stack Engineer'
    }
  },
  {
    id: 2,
    slug: 'Ecom circle',
    title: 'Ecom Circles',
    imageLight: '/assets/images/projects/cover/ecomcircles.png',
    blurHash: 'L4ADc400P*Zi4Tu1y;Qo00pH#YXl',
    site: 'https://app.ecomcircles.com/',
    description:
      'An application for dropshipping automation that manages repricing, item listing, order processing, and inventory management for U.S. marketplaces, including Amazon and Walmart.',
    techStack: ['MERN', 'AWS', 'Redis', 'Nginx', 'Redux'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/EcomCircle/1.png',
        '/assets/images/ProjectsImage/EcomCircle/2.png',
        '/assets/images/ProjectsImage/EcomCircle/3.png',
        '/assets/images/ProjectsImage/EcomCircle/4.png'
      ],
      longDescription: [
        'Contributed to building an advanced dropshipping automation platform for Amazon and Walmart.',
        'Implemented core automation features including repricing, product listing, order acknowledgment, and inventory management.',
        'Designed a two step dropshipping model with a warehouse intermediary to stay compliant with Amazon policies.',
        'Added detailed business analytics to help users make informed and data driven decisions.',
        'Designed and developed the complete backend architecture using Node.js, Express.js, and REST APIs.',
        'Integrated third party services such as Walmart APIs, Amazon SP API, Stripe, EasyPost, and Stamps.',
        'Built the frontend by converting Figma and wireframes into scalable components with React.js, SCSS, Bootstrap, and Redux.',
        'Worked with MySQL, Sequelize ORM, and Redis for data storage and performance optimization.',
        'Managed file storage and handling through AWS S3.',
        'Set up and maintained server infrastructure using AWS EC2, Nginx, Git, PM2, and CI/CD pipelines.',
        'Conducted code reviews and mentored team members to maintain quality and productivity.'
      ],
      role: 'Full Stack Engineer'
    }
  },
  {
    id: 3,
    slug: 'store Filter',
    title: 'Store Filter',
    imageLight: '/assets/images/projects/cover/storefilter.png',
    blurHash: 'L4ADc400P*Zi4Tu1y;Qo00pH#YXl',
    site: 'https://app.storefilter.com/',
    description:
      "A competitor analysis platform that focuses on keywords, ads, Shopify stores, and sales funnels to help businesses grow and understand their competitors' strategies.",
    techStack: ['Vue 3', 'VueX', 'Javascript'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/StoreFilter/1.png',
        '/assets/images/ProjectsImage/StoreFilter/2.png',
        '/assets/images/ProjectsImage/StoreFilter/3.png',
        '/assets/images/ProjectsImage/StoreFilter/4.png',
        '/assets/images/ProjectsImage/StoreFilter/5.png',
        '/assets/images/ProjectsImage/StoreFilter/6.png',
        '/assets/images/ProjectsImage/StoreFilter/7.png',
        '/assets/images/ProjectsImage/StoreFilter/8.png'
      ],
      longDescription: [
        'The challenge was to create a tool that could provide detailed insights into social media activity, search trends, keywords, ads, PR posts, and blogs, helping businesses grow by understanding their competition.',
        'The tool provided in depth reports on social media, keyword performance, ads, and other marketing strategies.',
        'This allowed users to refine their own strategies and stay ahead in the market. The final product delivered valuable insights, empowering businesses to make informed decisions and optimize their marketing efforts.'
      ],
      role: 'Frontend'
    }
  },
  {
    id: 4,
    slug: 'secure watch',
    title: 'Secur Watch',
    imageLight: '/assets/images/projects/cover/securwatch.png',
    blurHash: 'L4ADc400P*Zi4Tu1y;Qo00pH#YXl',
    site: 'http://secur-watch.com/',
    description:
      'An e-commerce website offering watches along with their historical reports, secured using blockchain technology.',
    techStack: ['Node', 'Next', 'MUI', 'Typescript', 'Blockchain'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/SecureWatch/1.png',
        '/assets/images/ProjectsImage/SecureWatch/2.png',
        '/assets/images/ProjectsImage/SecureWatch/3.png',
        '/assets/images/ProjectsImage/SecureWatch/4.png',
        '/assets/images/ProjectsImage/SecureWatch/5.png',
        '/assets/images/ProjectsImage/SecureWatch/6.png',
        '/assets/images/ProjectsImage/SecureWatch/7.png'
      ],
      longDescription: [
        'A client in the luxury watch market needed an e-commerce platform to sell watches and provide secure historical reports.',
        'The challenge was to ensure the authenticity and security of these reports, which are crucial in the luxury market.',
        'To solve this, we integrated blockchain technology to secure and verify the historical data, ensuring transparency and trust.',
        'We developed a user friendly platform where customers could browse and purchase watches while accessing secure, blockchain verified historical reports.',
        'This added a layer of trust and authenticity, enhancing the buying experience.'
      ],
      role: 'FullStack'
    }
  },
  {
    id: 5,
    slug: 'Mjm tools',
    title: 'MJM Tools',
    site: 'http://18.191.227.65/',
    imageLight: '/assets/images/projects/cover/mjmtools.png',
    blurHash: 'L0Aer?tjH[tPyAayj[j[00ay%xkB',
    description:
      "This is a management website designed to consolidate all of a user's Amazon marketplace activities into a single dashboard, including the management of listings, products, orders, sales, profits, and refunds.",
    techStack: ['Next', 'Javascript', 'Redux Toolkit'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/MJM/1.png',
        '/assets/images/ProjectsImage/MJM/2.png',
        '/assets/images/ProjectsImage/MJM/3.png',
        '/assets/images/ProjectsImage/MJM/4.png',
        '/assets/images/ProjectsImage/MJM/5.png'
      ],
      longDescription: [
        'The challenge was to create a single dashboard that consolidated listings, orders, sales, and refunds for global Amazon marketplaces, with automated data management and error handling. We developed a website that unified all activities into one dashboard, automating data pushes and creating alerts and Asana tasks for VAs if errors occurred.',
        'The final product streamlined global Amazon operations, reducing manual work and improving accuracy, showcasing our ability to create efficient, automated e-commerce management solutions.'
      ],
      role: 'Frontend'
    }
  },
  {
    id: 6,
    slug: 'Car Auction',
    title: 'Car Auction',
    imageLight: '/assets/images/projects/cover/carcouk.png',
    blurHash: 'L2M5%%0000EN00I:-oIp00kC?^sl',
    site: 'http://54.245.33.176:8443/login',
    description:
      'An auction website that allows users to bid on vehicles such as cars and bikes, facilitates invoice generation, vehicle delivery, and collects data on the auction winners.',
    techStack: ['React', 'MUI', 'Typescript'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/CarAuct/1.png',
        '/assets/images/ProjectsImage/CarAuct/2.png',
        '/assets/images/ProjectsImage/CarAuct/3.png',
        '/assets/images/ProjectsImage/CarAuct/4.png'
      ],
      longDescription: [
        'UK Car Auctions required a responsive platform to serve sellers and buyers effectively.',
        'The challenge was to create a website that provided a seamless experience on web and mobile devices.',
        'Additionally, the platform needed tools to facilitate the entire auction process, from listing vehicles to bidding and purchasing.',
        'We developed a responsive and user friendly website with a design that ensured consistent performance across all devices.',
        'Sellers could easily list vehicles, while buyers could browse, bid, and purchase efficiently. The platform features streamlined the auction process.'
      ],
      role: 'Frontend'
    }
  },
  {
    id: 7,
    slug: 'Better School',
    title: 'Better School',
    imageLight: '/assets/images/ProjectsImage/BetterSchool/2.PNG  ',
    blurHash: 'L2M5%%0000EN00I:-oIp00kC?^sl',
    site: 'https://betterschoolevents.com',
    description:
      'Better Scholl is a scholl event management platform designed to simplify event creation, sharing, and discovery. But with CI/CD custom payouts, geo based Alerts, assets optimization, and scable architecture.',
    techStack: ['React', 'MUI'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/BetterSchool/1.PNG',
        '/assets/images/ProjectsImage/BetterSchool/2.PNG',
        '/assets/images/ProjectsImage/BetterSchool/3.PNG',
        '/assets/images/ProjectsImage/BetterSchool/4.PNG',
        '/assets/images/ProjectsImage/BetterSchool/5.PNG'
      ],
      longDescription: [
        'Education happens everywhere, not just in books, but in hands on experiences, events, and local adventures. Our platform connects families with engaging, community driven events that enrich every childs journey. We are redefining education by showing that the best learning happens beyond the classroom.',
        'Whether you homeschool or just want to supplement your childs learning, BetterSchool makes discovering new events as easy as booking a ticket. We envision a world where learning is shared, friendships are built, and everyone feels connected.',
        'We bring a world of educational adventures to one simple platform.',
        'Anyone with a passion for education can become an organizer on BetterSchool.',
        'Teachers, parents, and local experts can host events, share knowledge, and earn income, all while making a positive impact.',
        'At BetterSchool we are committed to making education fun, accessible, and community focused for families.'
      ],
      role: 'Frontend'
    }
  },
  {
    id: 8,
    slug: 'SwitchBoard cloud',
    title: 'SwitchBoard Cloud',
    imageLight: '/assets/images/ProjectsImage/SwitchBoardCloud/1.PNG  ',
    blurHash: 'L2M5%%0000EN00I:-oIp00kC?^sl',
    site: 'https://www.switchboardcloud.com/',
    description:
      'Switchboard Cloud, demonstrating how retailers can connect their ERP, WMS, Shopify, WooCommerce, Amazon, Square and other systems directly to Temu. The page includes feature highlights, supported platform logos, a real case study, a testimonial slider, FAQs and a clear final call to action. Everything is fully responsive with custom styling and a clean, professional layout.',
    techStack: ['Next.js', 'Tailwind'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/SwitchBoardCloud/1.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/2.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/3.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/4.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/5.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/6.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/7.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/8.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/9.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/10.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/11.PNG',
        '/assets/images/ProjectsImage/SwitchBoardCloud/12.PNG'
      ],
      longDescription: [
        'Switchboard Cloud enables retailers to connect their ERP, WMS, Shopify, WooCommerce, Amazon, Square, and other systems directly to Temu with a streamlined integration experience.',
        'Our Temu page clearly explains how Switchboard automates inventory syncing, routes orders in real time, reduces manual work, and supports seamless expansion across new markets.',
        'Retailers can easily see all supported ecommerce platforms at a glance, including Shopify, WooCommerce, Square, BigCommerce, Ecwid, and more, making compatibility transparent and simple.',
        'A detailed case study showcases how one retailer improved fulfillment speed and achieved near zero inventory errors after switching to Switchboard integration with Temu.',
        'Customer trust is strengthened through a testimonial slider, highlighting real feedback from businesses benefiting from Switchboard automation.',
        'A helpful FAQ section guides visitors through common questions, such as why Temu is valuable for sellers and how Switchboard simplifies onboarding.',
        'The page ends with a clear call to action, encouraging retailers to start their Temu integration with confidence and ease.'
      ],
      role: 'Frontend'
    }
  },
  {
    id: 9,
    slug: 'SwitchBoard Access',
    title: 'SwitchBoard Access',
    imageLight: '/assets/images/ProjectsImage/SwitchBoardAccess/4.PNG  ',
    blurHash: 'L2M5%%0000EN00I:-oIp00kC?^sl',
    site: 'https://widget.dev.switchboardcloud.com.au/widgetTest.html?hostingProviderId=e5dd5414-4b7e-46e1-96de-e88c9e708497&companyName=DevMustafa123&managedConfiguration=true',
    description:
      'Switchboard Access Portal, a lightweight interface for partners to upload data, download data and view activity logs without using the main Switchboard dashboard. The portal includes secure login, a dashboard overview, upload and download workflows and a detailed activity log with statuses and timestamps, providing partners with a simple way to exchange data.',
    techStack: ['Next.js', 'Tailwind Css'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/SwitchBoardAccess/1.PNG',
        '/assets/images/ProjectsImage/SwitchBoardAccess/2.PNG',
        '/assets/images/ProjectsImage/SwitchBoardAccess/3.PNG',
        '/assets/images/ProjectsImage/SwitchBoardAccess/4.PNG',
        '/assets/images/ProjectsImage/SwitchBoardAccess/5.PNG'
      ],
      longDescription: [
        'The Switchboard Access Portal is a lightweight web interface built for partners who need to upload and download data without accessing the full Switchboard dashboard.',
        'The portal provides a secure login system where partners authenticate using their Access credentials, ensuring privacy and controlled access.',
        'A clear dashboard overview gives users quick visibility into activity counts, operations and timeline charts, helping them understand recent data flows.',
        'The Upload panel allows partners to submit supported files directly into Switchboard workflows, enabling fast and simple data ingestion.',
        'The Download panel provides tools to export orders, products, inventory and other data types, streamlining outbound integrations.',
        'A detailed Activity Log displays every upload and download event with information such as system, operation, status, activity type and timestamp. Users can filter, paginate and export these logs for better visibility.',
        'This portal serves as a simplified alternative to the full Switchboard interface, offering partners an easy way to exchange data and manage operations without navigating the main platform.',
        'In simple terms, the Access Portal gives partners a clean, efficient and secure workspace for sending and retrieving data, making their operational workflows much smoother.'
      ],
      role: 'Frontend'
    }
  },
  {
    id: 10,
    slug: 'SwitchBoard Onboarding Widget',
    title: 'SwitchBoard Onboarding Widget',
    imageLight: '/assets/images/ProjectsImage/Widget/2.PNG  ',
    blurHash: 'L2M5%%0000EN00I:-oIp00kC?^sl',
    site: 'https://widget.dev.switchboardcloud.com.au/widgetTest.html?hostingProviderId=e5dd5414-4b7e-46e[%E2%80%A6]companyName=DevMustafa123&managedConfiguration=true',
    description:
      'Implemented the Switchboard Customer Onboarding Widget, an embeddable script that lets users connect systems like Shopify, Amazon, NetSuite, Odoo and more without using the main Switchboard app. The widget automatically creates the organisation, sets up accounts, configures operations and builds the full connection workflow, allowing users to complete integrations quickly with no manual setup.',
    techStack: ['Next.js', 'Tailwind Css'],
    caseStudy: {
      images: [
        '/assets/images/ProjectsImage/Widget/2.PNG',
        '/assets/images/ProjectsImage/Widget/3.PNG',
        '/assets/images/ProjectsImage/Widget/4.PNG'
      ],
      longDescription: [
        'The Switchboard Customer Onboarding Widget is a fully embeddable tool that allows users to connect their systems to Switchboard without signing into the main platform.',
        'Before this widget, users had to manually create organisations, configure accounts, set up operations and navigate multiple steps inside the Switchboard dashboard, which made onboarding slow and technical.',
        'With the widget, users simply paste a script into any website or frontend app, instantly gaining access to a guided integration flow.',
        'The widget displays all supported systems such as Shopify, Amazon SP, NetSuite, Odoo, Cin7, Unleashed, Magento, WooCommerce and Finale Inventory, which allows users to choose the one they want to connect.',
        'Each system launches its own onboarding modal, whether it is an Odoo credentials form or a Shopify OAuth flow, ensuring a simple experience for every connector.',
        'The widget automatically creates the organisation inside Switchboard, sets up both source and destination accounts and configures the required workflows such as syncing inventory, syncing orders and loading products.',
        'It then establishes the full connection between systems with no need for users to navigate the main Switchboard interface.',
        'This approach removes all technical setup, speeds up onboarding, reduces support overhead and enables partners to offer Switchboard integrations directly on their websites.',
        'In simple words, the widget turns a multi step configuration process into an automated end to end workflow, which allows users to integrate their systems by just selecting a platform and entering basic details.'
      ],
      role: 'Frontend'
    }
  },
  {
    id: 11,
    slug: 'PensionTree',
    title: 'PensionTree',
    imageLight: '/assets/images/PassionTree/2.PNG',
    blurHash: 'L2M5%%0000EN00I:-oIp00kC?^sl',
    site: 'https://mypensiontree.com/',
    description:
      "Smart business owners don't settle for $70K limits. My Pension Tree offers business owners customized retirement plans, allowing tax-deductible contributions up to $214,083 more on average or more than a SEP-IRA, scaling retirement like their business.",
    techStack: ['Next.js', 'Tailwind Css', 'Firebase'],
    caseStudy: {
      images: [
        '/assets/images/PassionTree/1.PNG',
        '/assets/images/PassionTree/2.PNG',
        '/assets/images/PassionTree/3.PNG',
        '/assets/images/PassionTree/4.PNG',
        '/assets/images/PassionTree/5.PNG',
        '/assets/images/PassionTree/6.PNG',
        '/assets/images/PassionTree/7.PNG',
        '/assets/images/PassionTree/8.PNG',
        '/assets/images/PassionTree/9.PNG',
        '/assets/images/PassionTree/10.PNG',
        '/assets/images/PassionTree/11.PNG',
        '/assets/images/PassionTree/12.PNG',
        '/assets/images/PassionTree/13.PNG',
        '/assets/images/PassionTree/14.PNG'
      ],
longDescription: [
  'My Pension Tree is a platform designed to help high earning business owners access IRS approved Owner Benefit Plans that allow significantly higher tax deductible retirement contributions compared to traditional options like SEP IRAs and 401(k) plans.',
  'The project focuses on delivering fully customized retirement strategies based on a business owner’s age, income and company structure, enabling retirement savings to scale alongside business growth.',
  'A core goal of the platform is to remove complexity by handling actuarial design, IRS compliance and ongoing administration, allowing users to focus entirely on running their businesses.',
  'The solution highlights proven real world outcomes, including six figure annual tax savings and retirement contributions exceeding $200,000 for qualified business owners.',
  'The platform also emphasizes trust and transparency by showcasing real client testimonials, quantified tax savings and clear explanations of how Owner Benefit Plans work.',
  'Worked as a Frontend Developer on this project, responsible for building responsive, high performance user interfaces that clearly communicate complex financial and tax related information.',
  'Translated detailed retirement and tax saving concepts into clean, user friendly layouts that improve clarity, engagement and conversion for business owners.',
  'Developed reusable and scalable frontend components to present plan benefits, contribution comparisons and testimonials consistently across the site.',
  'Collaborated with stakeholders to refine messaging and visual hierarchy, ensuring the frontend accurately reflects business value while remaining easy to understand.',
  'Focused on performance, accessibility and maintainability to deliver a fast, reliable and future ready frontend experience.'
],
      role: 'Frontend Developer'
    }
  }
];
