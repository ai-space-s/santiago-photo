const toBase64Url = (input: string) => {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const createOriginalPhotoUrl = (originalPath: string) =>
  `camino-thumbnail://original/${toBase64Url(originalPath)}`;
