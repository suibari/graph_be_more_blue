export async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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
