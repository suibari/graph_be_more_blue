export async function imageToBase64(url: string): Promise<string | null> {
  let imageUrl = url;
  // 縮小版のURLを試す
  if (url.includes('/avatar/')) {
    const thumbnail_url = url.replace('/avatar/', '/avatar_thumbnail/');
    try {
      const response = await fetch(thumbnail_url);
      if (response.ok) {
        imageUrl = thumbnail_url;
      } else {
        console.warn(`Failed to fetch thumbnail from ${thumbnail_url}, trying original URL.`);
      }
    } catch (error) {
      console.warn(`Error fetching thumbnail from ${thumbnail_url}, trying original URL.`, error);
    }
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.statusText}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type');
    if (!mimeType) {
      console.error('Could not determine MIME type for image.');
      return null;
    }
    const base64data = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return base64data;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}
