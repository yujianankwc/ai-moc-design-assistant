import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const BUCKET = "reference-images";
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60 * 24 * 14;

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少图片文件。" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "仅支持 JPG、PNG、WebP、GIF 格式的图片。" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `图片大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB。` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const ext = extFromMime(file.type);
    const filePath = `${timestamp}-${random}.${ext}`;

    const supabase = getSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("[upload-reference] Supabase upload error:", uploadError.message);
      return NextResponse.json(
        { error: "参考图上传失败，请稍后重试。" },
        { status: 500 }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRES_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[upload-reference] signed url error:", signedUrlError?.message || "missing signed url");
      return NextResponse.json(
        { error: "参考图已经上传，但暂时没法继续使用，请稍后重试。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedUrlData.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "参考图上传失败";
    console.error("[upload-reference] unexpected error:", message);
    return NextResponse.json({ error: "参考图上传失败，请稍后重试。" }, { status: 500 });
  }
}
