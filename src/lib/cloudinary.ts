const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim()
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim()

export const isCloudinaryConfigured = Boolean(cloudName && uploadPreset)

type CloudinaryUpload = {
  secure_url: string
  public_id: string
}

function optimizedImageUrl(url: string) {
  return url.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_1600/')
}

export async function uploadProductImage(file: File): Promise<{ url: string; path: string }> {
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary n'est pas configure pour les photos.")
  if (!file.type.startsWith('image/')) throw new Error('Seules les images sont acceptees.')
  if (file.size > 10 * 1024 * 1024) throw new Error('La photo doit faire moins de 10 Mo.')

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body,
  })
  const result = await response.json() as CloudinaryUpload & { error?: { message?: string } }
  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message || 'Impossible de televerser la photo vers Cloudinary.')
  }

  return { url: optimizedImageUrl(result.secure_url), path: `cloudinary:${result.public_id}` }
}

export function isCloudinaryPath(path?: string | null) {
  return Boolean(path?.startsWith('cloudinary:'))
}
