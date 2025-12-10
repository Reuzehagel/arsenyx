// Curated external resources for the guides page
export interface CuratedResource {
    id: string;
    title: string;
    description: string;
    url: string;
}

export const CURATED_RESOURCES: CuratedResource[] = [
    {
        id: "profit-taker",
        title: "Profit-Taker Guide",
        description: "Comprehensive guide for the Profit-Taker fight, including builds and strategies.",
        url: "https://profit-taker.com/",
    },
];
