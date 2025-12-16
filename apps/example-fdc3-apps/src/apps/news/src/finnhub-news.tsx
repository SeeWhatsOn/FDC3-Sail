import React, { useState, useEffect } from 'react'

export interface NewsItem {
    id: number
    title: string
    time: string
    thumbnail: string
}

export interface Article {
    category: string;
    datetime: number;
    headline: string;
    id: number;
    image: string;
    related: string;
    source: string;
    summary: string;
    url: string;
}

async function getCompanyNews(symbol: string, from: string, to: string): Promise<NewsItem[]> {
    try {
        console.log(`Fetching news for ${symbol} from ${from} to ${to}`)
        const news_url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${import.meta.env.VITE_FINNHUB_API_KEY}`
        const response = await fetch(news_url)
        const data: Article[] = await response.json()

        const top20 = data.slice(0, 20)

        return top20.map((article) => ({
            id: article.id,
            title: article.headline,
            time: new Date(article.datetime * 1000).toLocaleString(),
            thumbnail: article.image ? resizeImageUrl(article.image, 400, 300) : article.image,
        }))
    } catch (error) {
        console.error('Error:', error)
        return []
    }
}

function resizeImageUrl(url: string, width: number, height: number): string {
    try {
        if (url.includes('cloudinary.com')) {
            return url.replace(/\/upload\//, `/upload/w_${width},h_${height},c_fill/`);
        }
        if (url.includes('imgix.net')) {
            return `${url}?w=${width}&h=${height}&fit=crop`;
        }
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${width}&h=${height}&fit=cover`;
    } catch {
        return url;
    }
}

interface FinnhubNewsFeedProps {
    symbol: string
}

export default function FinnhubNewsFeed(props: FinnhubNewsFeedProps) {
    const [newsItems, setNewsItems] = useState<NewsItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchNews = async () => {
            setIsLoading(true)
            const res = await getCompanyNews(props.symbol, "2025-01-01", "2025-01-03")
            setNewsItems(res)
            setIsLoading(false)
        }
        fetchNews()
    }, [props.symbol])

    return (
        <div className="min-h-screen bg-black text-white p-4">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold mb-6 text-center">Top Stories</h1>
                <div className="grid gap-6 sm:grid-cols-2">
                    {isLoading ? (
                        // Skeleton loader
                        Array.from({ length: 20 }).map((_, index) => (
                            <div key={index} className="animate-pulse rounded-lg overflow-hidden">
                                <div className="relative aspect-video w-full">
                                    <div className="bg-zinc-800 w-full h-full rounded-lg"></div>
                                </div>
                                <div className="p-4">
                                    <div className="h-4 bg-zinc-800 rounded w-1/4 mb-2"></div>
                                    <div className="h-4 bg-zinc-800 rounded w-full"></div>
                                </div>
                            </div>
                        ))
                    ) : newsItems.length > 0 ? (
                        newsItems.map((item) => (
                            <button
                                key={item.id}
                                className="w-full text-left cursor-pointer transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-700 rounded-lg overflow-hidden group"
                                onClick={() => console.log(`Clicked article: ${item.title}`)}
                            >
                                <div className="relative aspect-video w-full overflow-hidden">
                                    <img
                                        src={item.thumbnail || "/placeholder.svg"}
                                        alt=""
                                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    />
                                </div>
                                <div className="p-4">
                                    <div className="text-sm text-gray-400 mb-2">{item.time}</div>
                                    <h2 className="text-base font-medium leading-snug transition-colors duration-200 group-hover:text-gray-300">
                                        {item.title}
                                    </h2>
                                </div>
                            </button>
                        ))
                    ) : (
                        // No articles state
                        <div className="col-span-2 text-center py-10">
                            <p className="text-xl text-gray-400">No articles available at the moment.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

