import { toJsonLdDocuments } from "./JsonLd";

describe("toJsonLdDocuments", () => {
  it("keeps a single object as-is", () => {
    const input = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Sri Palani Textiles",
    };
    expect(toJsonLdDocuments(input)).toEqual([input]);
  });

  it("wraps arrays in a single @graph document", () => {
    const docs = toJsonLdDocuments([
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Sri Palani Textiles",
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Sri Palani Textiles",
      },
    ]);

    expect(docs).toHaveLength(1);
    expect(docs[0]?.["@context"]).toBe("https://schema.org");
    expect(docs[0]?.["@graph"]).toEqual([
      { "@type": "Organization", name: "Sri Palani Textiles" },
      { "@type": "WebSite", name: "Sri Palani Textiles" },
    ]);
  });

  it("returns empty list for empty arrays", () => {
    expect(toJsonLdDocuments([])).toEqual([]);
  });
});
