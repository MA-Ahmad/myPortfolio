import { Fragment } from 'react';
import TopNav from '../shared/top-nav';
import Footer from '../shared/footer';
import styles from './appLayout.module.css';

function AppLayout(props) {
  return (
    <Fragment>
      <TopNav />
      <DottedSvgs />
      <div className="mx-auto w-[90%] min-w-0 max-w-[800px] text-center text-xl sm:w-[85%] lg:w-[80%]">
        <div className="pb-10 pt-28">{props.children}</div>
      </div>
      <Footer />
    </Fragment>
  );
}

function DottedSvgs() {
  return (
    <div className="absolute z-[-1] hidden h-[50rem] w-full overflow-hidden lg:block">
      <div className="relative mx-auto h-full max-w-[940px]">
        <div className="absolute left-full">
          <svg
            className={`${styles.dottedRightTransform} ${styles.dottedColor}`}
            color="rgba(55,65,81, 1)"
            width="404"
            height="784"
            fill="none"
            viewBox="0 0 404 784"
          >
            <defs>
              <pattern
                id="5d0dd344-b041-4d26-bec4-8d33ea57ec9b"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect x="0" y="0" width="4" height="4" fill="currentColor"></rect>
              </pattern>
            </defs>
            <rect width="404" height="784" fill="url(#5d0dd344-b041-4d26-bec4-8d33ea57ec9b)"></rect>
          </svg>
        </div>
        <div className="absolute right-full">
          <svg
            className={`${styles.dottedLeftTransform}`}
            color="rgba(55,65,81, 1)"
            width="404"
            height="784"
            fill="none"
            viewBox="0 0 404 784"
          >
            <defs>
              <pattern
                id="5d0dd344-b041-4d26-bec4-8d33ea57ec9c"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect x="0" y="0" width="4" height="4" fill="currentColor"></rect>
              </pattern>
            </defs>
            <rect width="404" height="784" fill="url(#5d0dd344-b041-4d26-bec4-8d33ea57ec9c)"></rect>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
