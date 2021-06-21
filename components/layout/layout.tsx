import { Fragment } from 'react';
import { Box } from "@chakra-ui/react";
import TopNav from "./top-nav";
import Footer from "./footer";

function Layout(props) {
    return (
        <Fragment>
            <TopNav />
            <Box
                textAlign="center"
                fontSize="xl"
                w={["90%", "85%", "80%"]}
                maxW={800}
                mx="auto"
            >
                <Box pt={10} pb={10}>
                    {props.children}
                </Box>
            </Box>
            <Footer />
        </Fragment>
    );
}

export default Layout;
