import * as React from "react";
import Achievements from "../components/achievements/achievements";
import Meta from '../components/layout/meta';

const Index = () => {
    return (
        <React.Fragment>
            <Meta title='Achievements' keywords="My achievements" />
            <Achievements />
        </React.Fragment>
    )
};

export default Index;
