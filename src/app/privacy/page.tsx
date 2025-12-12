import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SITE_CONFIG } from "@/lib/constants";

export default function PrivacyPage() {
    return (
        <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-12 max-w-3xl">
                <div className="space-y-6">
                    <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
                    <p className="text-muted-foreground">
                        Last updated: {new Date().toLocaleDateString()}
                    </p>

                    <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
                        <section>
                            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
                            <p>
                                {SITE_CONFIG.name} is designed to be privacy-friendly. We minimize the data we collect.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>
                                    <strong>Authentication Data:</strong> If you sign in, we store your basic profile information provided
                                    by the authentication provider (e.g., GitHub, Discord).
                                </li>
                                <li>
                                    <strong>Usage Data:</strong> We may collect anonymous analytics data to understand
                                    how our service is used and to improve it.
                                </li>
                                <li>
                                    <strong>User Content:</strong> Builds and guides you create and save are stored in our database.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
                            <p>
                                We use the collected information solely for providing and improving the service.
                                We do not sell your personal data to third parties.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4">3. Cookies and Local Storage</h2>
                            <p>
                                We use cookies and local storage to maintain your session and store your preferences.
                                These are essential for the functioning of the application.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4">4. Third-Party Services</h2>
                            <p>
                                Our service may use third-party services for authentication, hosting, and analytics.
                                Please review their respective privacy policies for more information.
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
