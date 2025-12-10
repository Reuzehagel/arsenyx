// Seed data for guides (mock data for development)
import type { Guide } from "./types";
import { SerializedEditorState } from "lexical";

// Helper to create empty editor state with initial content
function createEditorState(paragraphs: string[]): SerializedEditorState {
    return {
        root: {
            children: paragraphs.map((text) => ({
                children: text
                    ? [
                        {
                            detail: 0,
                            format: 0,
                            mode: "normal",
                            style: "",
                            text,
                            type: "text",
                            version: 1,
                        },
                    ]
                    : [],
                direction: "ltr",
                format: "",
                indent: 0,
                type: "paragraph",
                version: 1,
                textFormat: 0,
                textStyle: "",
            })),
            direction: "ltr",
            format: "",
            indent: 0,
            type: "root",
            version: 1,
        },
    } as unknown as SerializedEditorState;
}

// Seed guides
export const SEED_GUIDES: Guide[] = [
    {
        id: "railjack-basics",
        slug: "railjack-basics",
        title: "Railjack Basics: Getting Started",
        summary:
            "Everything you need to know to start your journey into Empyrean. Learn about your Railjack, intrinsics, and crew management.",
        category: "systems",
        tags: ["railjack", "empyrean", "beginner", "crew"],
        coverImage: "/guides/railjack-cover.jpg",
        readingTime: 8,
        createdAt: "2024-11-01T10:00:00Z",
        updatedAt: "2024-12-05T14:30:00Z",
        author: {
            name: "TennoGuide",
        },
        status: "published",
        isCurated: true,
        content: createEditorState([
            "Railjack is Warframe's ship-based combat system introduced in the Empyrean update. It offers a unique blend of space combat, ground missions, and cooperative gameplay.",
            "",
            "Your Railjack is your mobile base of operations in space. You can customize it with different components, armaments, and tactical abilities. The key systems to understand are:",
            "",
            "1. Piloting - Control the main ship, fire primary weapons, and navigate the battlefield",
            "2. Gunnery - Man the side turrets to take down fighters and crewships",
            "3. Engineering - Repair hull breaches, extinguish fires, and manage the forge",
            "4. Tactical - Use the tactical menu to cast ship abilities and teleport crew",
            "",
            "Intrinsics are your personal progression in Railjack. There are five categories: Tactical, Piloting, Gunnery, Engineering, and Command. Each offers unique abilities and improvements.",
            "",
            "Crew members can be hired from Ticker on Fortuna. They can be assigned to different roles on your ship, from piloting to gunnery to defending against boarders.",
            "",
            "Start with Earth Proxima missions to learn the basics, then progress to Venus, Neptune, and finally the Veil Proxima for the most challenging content.",
        ]),
        relatedGuideIds: ["endo-farming-routes"],
    },
    {
        id: "endo-farming-routes",
        slug: "endo-farming-routes",
        title: "Endo Farming: Best Routes & Methods",
        summary:
            "Maximize your Endo gains with these proven farming strategies. From Arbitrations to Steel Path, find the method that works for you.",
        category: "resources",
        tags: ["endo", "farming", "arbitrations", "steel-path"],
        readingTime: 6,
        createdAt: "2024-10-15T08:00:00Z",
        updatedAt: "2024-12-01T09:00:00Z",
        author: {
            name: "FarmMaster",
        },
        status: "published",
        content: createEditorState([
            "Endo is one of the most important resources in Warframe: used to upgrade mods to their maximum potential. Here are the best ways to farm it.",
            "",
            "Arbitrations are the premier Endo farming method. Each rotation drops guaranteed Endo, with amounts scaling based on the mission type. Survival and Excavation are generally the fastest.",
            "",
            "Steel Path Incursions offer bonus Endo rewards and Steel Essence, making them efficient for veterans who can handle the increased difficulty.",
            "",
            "Maroo's Ayatan Sculpture hunts, available weekly, provide sculptures that can be filled with Stars and traded for large amounts of Endo.",
            "",
            "Disruption missions on Ur (Uranus) or Apollo (Lua) can drop Endo and have the chance for Sculpture drops. Great for players who enjoy the fast-paced mode.",
            "",
            "Railjack Grineer missions have a chance to drop Endo from containers and reward it from mission completion.",
            "",
            "Don't forget: Duplicate mods can be dissolved for Endo. Check your inventory regularly for mods you don't need!",
        ]),
        relatedGuideIds: ["railjack-basics"],
    },
];

// Get all seed guides
export function getSeedGuides(): Guide[] {
    return SEED_GUIDES;
}

// Get a single seed guide by slug
export function getSeedGuideBySlug(slug: string): Guide | undefined {
    return SEED_GUIDES.find((guide) => guide.slug === slug);
}
