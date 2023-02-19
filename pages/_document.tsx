import Document, { Head, Html, Main, NextScript } from "next/document";

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="icon" href="/favicon.ico" />
          <meta
            name="description"
            content="Restore your old face photos and keep the memories alive."
          />
          <meta property="og:site_name" content="restorePhotos.io" />
          <meta
            property="og:description"
            content="Restore your old face photos and keep the memories alive."
          />
          <meta property="og:title" content="Instagram Caption Generator" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Caption Generator" />
          <meta
            name="twitter:description"
            content="Upload a photo and get perfect Instagram caption options."
          />
          <meta
            property="og:image"
            content="https://restore-photos.vercel.app/og-image.png"
          />
          {/* <meta
            name="twitter:image"
            content="https://restore-photos.vercel.app/og-image.png"
          /> */}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
