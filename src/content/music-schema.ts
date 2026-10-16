import { z } from "zod";

export const videoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/);
export const musicTrackSchema = z
  .object({
    videoId: videoIdSchema,
    title: z.string().trim().min(1).max(150),
    titleVi: z.string().trim().max(150),
    pinyin: z.string().trim().max(300),
    artist: z.string().trim().min(1).max(100),
    pace: z.enum(["easy", "medium", "challenge", "unknown"]),
    mood: z.enum(["calm", "bright", "nostalgic", "personal"]),
    tip: z.string().trim().max(300),
  })
  .strict();
export const trackListSchema = z
  .array(musicTrackSchema)
  .max(100)
  .refine(
    (tracks) => new Set(tracks.map((t) => t.videoId)).size === tracks.length,
    "Danh sách có video trùng.",
  );
export const musicCatalogSchema = z
  .object({
    version: z.literal(1),
    tracks: trackListSchema,
    playlists: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,60}$/),
            name: z.string().trim().min(1).max(80),
            description: z.string().trim().max(300),
            author: z.string().trim().min(1).max(80).optional(),
            youtubePlaylistId: z
              .string()
              .regex(/^PL[a-zA-Z0-9_-]{10,98}$/)
              .optional(),
            videoIds: z.array(videoIdSchema).min(1).max(100),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const ids = new Set(catalog.tracks.map((t) => t.videoId));
    if (
      new Set(catalog.playlists.map((p) => p.id)).size !==
        catalog.playlists.length ||
      catalog.playlists.some(
        (p) =>
          new Set(p.videoIds).size !== p.videoIds.length ||
          p.videoIds.some((id) => !ids.has(id)),
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Playlist phải có mã riêng và chỉ tham chiếu các bài có trong thư viện.",
      });
  });
export const musicPlaylistSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    raw: z
      .string()
      .max(50000)
      .refine((raw) => {
        try {
          return (
            new TextEncoder().encode(raw).length <= 50000 &&
            trackListSchema.safeParse(JSON.parse(raw)).success
          );
        } catch {
          return false;
        }
      }, "Danh sách bài hát không hợp lệ hoặc lớn hơn 50 KB."),
    deleted: z.boolean(),
    visibility: z.enum(["private", "public"]).default("private"),
    updatedAt: z.number().finite().nonnegative(),
  })
  .strict();
export type MusicTrack = z.infer<typeof musicTrackSchema>;
export type MusicCatalog = z.infer<typeof musicCatalogSchema>;
export type MusicPlaylist = z.infer<typeof musicPlaylistSchema>;
export const publicMusicPlaylistSchema = musicPlaylistSchema
  .pick({ name: true, raw: true })
  .extend({
    playlistId: z.string().uuid(),
    ownerUid: z.string().min(1).max(128),
    authorName: z.string().trim().min(1).max(40),
    sourceUpdatedAt: z.number().finite().nonnegative(),
  })
  .strict();
export type PublicMusicPlaylist = z.infer<typeof publicMusicPlaylistSchema>;
