import { describe, expect, it } from "vitest";
import { stripComments, stripTags, unwrapComments } from "./markup";

describe("stripTags", () => {
  it("removes tags and keeps the words", () => {
    expect(stripTags("<color=#f29e38ff>Fire</color> DMG")).toBe("Fire DMG");
    expect(stripTags("<unbreak>All-Out</unbreak>")).toBe("All-Out");
  });
  it("leaves no tag behind when tags are nested inside tags", () => {
    expect(stripTags("<scr<b>ipt>alert(1)</scr</i>ipt>")).toBe("alert(1)");
    expect(stripTags("<<b>img src=x onerror=1>")).not.toMatch(/<[a-z]/i);
  });
  it("can remove only the named tags", () => {
    expect(
      stripTags("<color=#fff>Hit</color> <Term:12>x</Term>", ["color"]),
    ).toBe("Hit <Term:12>x</Term>");
    expect(stripTags("<i>a</i> <icon>", ["i", "b"])).toBe("a <icon>");
    expect(stripTags("<co<color>lor=1>x", ["color"])).toBe("x");
  });
  it("keeps plain text with < or > that is not a tag", () => {
    expect(stripTags("HP < 50%")).toBe("HP < 50%");
    expect(stripTags("a > b")).toBe("a > b");
  });
});

describe("comments", () => {
  it("stripComments removes comments and anything that would rebuild one", () => {
    expect(stripComments("a<!-- hidden -->b")).toBe("ab");
    expect(stripComments("<!<!--x-->-- y -->")).not.toContain("<!--");
    expect(stripComments("a <!-- never closed")).toBe("a  never closed");
  });
  it("unwrapComments keeps what was inside and leaves no marker", () => {
    expect(unwrapComments("|Jade = <!-- 300 -->")).toBe("|Jade =  300 ");
    expect(unwrapComments("<!<!---->--")).toBe("");
    expect(unwrapComments("<!<!--x-->--")).not.toMatch(/<!--|-->/);
  });
});
