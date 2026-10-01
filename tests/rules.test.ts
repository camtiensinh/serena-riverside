import test from "node:test";
import assert from "node:assert/strict";
import { checkPost, facebookUrl, rank, matchesPost } from "../src/lib/rules";
import { postImages } from "../src/lib/media";

test("Disabled time filter accepts old or missing timestamp but still requires hashtags", () => {
  const rules = { ...settings, time_filter_enabled: false };
  const old = checkPost(
    { text: "#SerenaRiverside #KickoffSerena", time: "2020-01-01T00:00:00Z" },
    rules,
  );
  assert.equal(old.timeOk, true);
  assert.equal(old.reason, "");
  assert.equal(
    checkPost({ text: "#SerenaRiverside #KickoffSerena" }, rules).timeOk,
    true,
  );
  assert.equal(checkPost({ text: "#SerenaRiverside" }, rules).hashtagOk, false);
});
test("Apify media uses photo URI, falls back to thumbnail, deduplicates and rejects unsafe URLs", () => {
  assert.deepEqual(
    postImages([
      {
        photo_image: { uri: "https://cdn.example.com/a.jpg" },
        thumbnail: "https://cdn.example.com/low.jpg",
      },
      { thumbnail: "https://cdn.example.com/b.jpg" },
      { photo_image: { uri: "https://cdn.example.com/a.jpg" } },
      { thumbnail: "javascript:alert(1)" },
    ]),
    ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
  );
});

test("Apify album subattachments expose nested viewer images", () => {
  const first = "https://cdn.example.com/album-1.jpg";
  const second = "https://cdn.example.com/album-2.jpg";
  assert.deepEqual(
    postImages([
      {
        two_photos_subattachments: {
          nodes: [{ media: { id: "1", viewer_image: { uri: first } } }],
        },
        five_photos_subattachments: {
          nodes: [
            { media: { id: "1", viewer_image: { uri: first } } },
            { media: { id: "2", viewer_image: { uri: second } } },
          ],
        },
      },
    ]),
    [first, second],
  );
});

test("Returned Apify item must belong to the submitted post", () => {
  assert.equal(
    matchesPost("https://www.facebook.com/u/posts/123", { postId: "123" }),
    true,
  );
  assert.equal(
    matchesPost("https://www.facebook.com/u/posts/123", {
      postId: "456",
      url: "https://www.facebook.com/u/posts/456",
    }),
    false,
  );
  assert.equal(
    matchesPost("https://www.facebook.com/share/p/abc", {
      facebookUrl: "https://www.facebook.com/share/p/abc",
      postId: "123",
    }),
    true,
  );
});
const settings = {
  starts_at: "2026-09-11T01:00:00.000Z",
  ends_at: "2026-09-11T05:00:00.000Z",
  hashtags: ["SerenaRiverside", "KickoffSerena"],
};
test("Hashtags use case-insensitive exact matching", () => {
  assert.equal(
    checkPost(
      { text: "#serenariverside #KICKOFFSERENA", time: settings.starts_at },
      settings,
    ).hashtagOk,
    true,
  );
  assert.equal(
    checkPost(
      { text: "#SerenaRiversideFake #KickoffSerena", time: settings.starts_at },
      settings,
    ).hashtagOk,
    false,
  );
  assert.equal(
    checkPost(
      { text: "#SerenaRiverside_ #KickoffSerena", time: settings.starts_at },
      settings,
    ).hashtagOk,
    false,
  );
  assert.equal(
    checkPost(
      {
        text: "SerenaRiverside không có dấu thăng #KickoffSerena",
        time: settings.starts_at,
      },
      settings,
    ).hashtagOk,
    false,
  );
  assert.equal(
    checkPost(
      { text: "#SERENAKHOIDONG2026", time: settings.starts_at },
      { ...settings, hashtags: ["SerenaKhoidong"] },
    ).hashtagOk,
    false,
  );
  assert.equal(
    checkPost(
      { text: "Cùng tham dự #sErEnAkHoIdOnG!", time: settings.starts_at },
      { ...settings, hashtags: ["SerenaKhoidong"] },
    ).hashtagOk,
    true,
  );
});
test("Vietnam event start and end are inclusive; invalid dates rejected", () => {
  assert.equal(checkPost({ time: settings.starts_at }, settings).timeOk, true);
  assert.equal(checkPost({ time: settings.ends_at }, settings).timeOk, true);
  assert.equal(
    checkPost({ time: "2026-09-11T00:59:59Z" }, settings).timeOk,
    false,
  );
  assert.equal(checkPost({ time: "bad" }, settings).timeOk, false);
  assert.equal(checkPost({}, settings).timeOk, false);
});
test("Like is never silently replaced with total reactions", () => {
  assert.equal(
    checkPost({ likes: 46, reactionLikeCount: 31 }, settings).likes,
    31,
  );
  assert.equal(checkPost({ likes: 46 }, settings).likes, null);
  assert.equal(checkPost({ reactionLikeCount: 0 }, settings).likes, 0);
});
test("Facebook link validation rejects unrelated hosts and profile links", () => {
  assert.throws(() => facebookUrl("https://facebook.com.evil.test/u/posts/1"));
  assert.throws(() => facebookUrl("https://www.facebook.com/profile"));
  assert.throws(() => facebookUrl("http://facebook.com/u/posts/1"));
  assert.equal(
    facebookUrl("https://m.facebook.com/u/posts/123?fbclid=tracking"),
    "https://www.facebook.com/u/posts/123",
  );
  assert.equal(
    facebookUrl(
      "https://www.facebook.com/story.php?story_fbid=123&id=4&fbclid=a",
    ),
    "https://www.facebook.com/story.php?story_fbid=123&id=4",
  );
});
test("Facebook shared links from mobile are accepted and matched", () => {
  for (const path of [
    "share/194WQLJnAd/",
    "share/p/1MjkVKLdKK/",
    "share/r/123Abc/",
    "share/v/456Def/",
  ]) {
    const input = "https://m.facebook.com/" + path + "?mibextid=tracking";
    const normalized = "https://www.facebook.com/" + path.slice(0, -1);
    assert.equal(facebookUrl(input), normalized);
    assert.equal(matchesPost(input, { facebookUrl: normalized }), true);
    assert.equal(
      matchesPost(input, {
        facebookUrl: "https://www.facebook.com/share/other",
      }),
      false,
    );
  }
  assert.throws(() => facebookUrl("https://www.facebook.com/share/"));
  assert.throws(() => facebookUrl("https://www.facebook.com/share/abc/extra"));
  assert.throws(() => facebookUrl("not a url"), /Vui lòng/);
});
test("Ranking uses metric then earlier post then stable ID", () => {
  const rows = [
    {
      id: "b",
      likes: 31,
      reactions: 80,
      posted_at: "2026-09-11T02:00:00Z",
      created_at: "",
    },
    {
      id: "a",
      likes: 31,
      reactions: 46,
      posted_at: "2026-09-11T01:00:00Z",
      created_at: "",
    },
    {
      id: "c",
      likes: 40,
      reactions: 50,
      posted_at: "2026-09-11T03:00:00Z",
      created_at: "",
    },
  ];
  assert.deepEqual(
    rank(rows, "likes").map((r) => r.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    rank(rows, "reactions").map((r) => r.id),
    ["b", "c", "a"],
  );
  assert.equal(rows[0].id, "b");
});
