import React from "react";
import { Star } from "lucide-react";

interface BookMetadataProps {
    views: number;
    ratingCount: number;
    averageRating?: number;
    isNewArrival?: boolean;
    bookId?: string;
}

export function BookMetadata({ views, ratingCount, averageRating, isNewArrival, bookId }: BookMetadataProps) {
    const displayCount = ratingCount !== undefined ? ratingCount : 0;
    const isMostPopular = views >= 1500 && views <= 2000 && ratingCount >= 100 && ratingCount <= 120;
    const displayRating = (displayCount > 0 && averageRating !== undefined) ? Number(averageRating).toFixed(1) : null;

    return (
        <div className="flex items-center gap-2 sm:gap-3 text-sm text-muted-foreground flex-wrap">
            {displayRating && (
                <div className="flex items-center gap-1 font-medium text-foreground">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 shrink-0" />
                    <span>{displayRating}</span>
                </div>
            )}

            {displayRating && <span>•</span>}

            {isMostPopular && (
                <>
                    <span>{Math.floor(views)} views</span>
                    <span>•</span>
                </>
            )}

            <span>
                {`Rated by ${displayCount} users`}
            </span>
        </div>
    );
}
