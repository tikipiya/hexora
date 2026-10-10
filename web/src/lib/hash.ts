export interface FileHashes {
  sha256: string;
  sha1: string;
}

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashFile(data: ArrayBuffer): Promise<FileHashes> {
  const [sha256, sha1] = await Promise.all([
    crypto.subtle.digest("SHA-256", data),
    crypto.subtle.digest("SHA-1", data),
  ]);
  return {
    sha256: bufToHex(sha256),
    sha1: bufToHex(sha1),
  };
}
