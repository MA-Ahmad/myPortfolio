import * as React from 'react';
import ProgressiveImage from 'react-progressive-image';
import { BlurhashCanvas } from 'react-blurhash';
import { cn } from 'lib/cn';

const Progressive = ProgressiveImage as unknown as React.FC<{
  delay?: number;
  src: string;
  placeholder: string;
  children: (src: string, loading: boolean) => React.ReactNode;
}>;

type LazyImageProps = {
  src: string;
  blurHash: string;
  size?: string;
  width?: number;
  height?: number;
  layout?: string;
  rounded?: string;
};

const LazyImage = (props: LazyImageProps) => {
  const { src, blurHash, width, height, rounded } = props;
  const placeholder = '/assets/images/placeholder.png';
  const fill = !width && !height;

  return (
    <Progressive delay={500} src={src} placeholder={placeholder}>
      {(loadedSrc, loading) => {
        return loading ? (
          <BlurhashCanvas
            hash={blurHash}
            width={width || 400}
            height={height || 216}
            punch={1}
            className={cn(fill && 'block h-full w-full')}
            style={{
              borderRadius: rounded ? '5px' : '',
              width: fill ? '100%' : width,
              height: fill ? '100%' : height
            }}
          />
        ) : (
          <img
            src={loadedSrc}
            alt="cover image"
            width={width}
            height={height}
            className={cn('object-cover', fill && 'block h-full w-full')}
            style={{ borderRadius: rounded ? '5px' : undefined }}
            onError={(event) => {
              event.currentTarget.src = placeholder;
            }}
          />
        );
      }}
    </Progressive>
  );
};

export default LazyImage;
