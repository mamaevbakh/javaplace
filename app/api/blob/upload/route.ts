import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

import { getCurrentMerchant } from "@/lib/merchant-auth"
import { rateLimit } from "@/lib/rate-limit"

// Client-upload token endpoint for vendor photos (see @vercel/blob/client `upload`).
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Only signed-in merchants may upload.
        const merchant = await getCurrentMerchant()
        if (!merchant) throw new Error("unauthorized")
        // Cap uploads per merchant to prevent blob-storage abuse.
        if (!(await rateLimit(`upload:${merchant.id}`, 30, 600)).ok) {
          throw new Error("rate_limited")
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          maximumSizeInBytes: 8 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
      // The client persists the returned URL via a server action, so this is a no-op.
      onUploadCompleted: async () => {},
    })
    return Response.json(result)
  } catch (error) {
    const message = (error as Error).message
    const status =
      message === "unauthorized" ? 401 : message === "rate_limited" ? 429 : 400
    return Response.json({ error: message }, { status })
  }
}
