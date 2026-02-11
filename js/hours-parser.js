/**
 * hours-parser.js - 営業時間解析ユーティリティ
 */

const HoursParser = {
    /**
     * weekday_text から現在営業中かを判定
     * @param {Array<string>} weekdayText - ["月曜日: 7時00分～20時00分", ...]
     * @returns {boolean} 営業中ならtrue
     */
    isCurrentlyOpen(weekdayText) {
        if (!weekdayText || weekdayText.length === 0) {
            return null; // 営業時間情報なし
        }

        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=日, 1=月, ..., 6=土
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        // Google の weekday_text は月曜始まり (0=月, 6=日)
        const googleDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const todayText = weekdayText[googleDayIndex];

        if (!todayText) {
            return null;
        }

        // "定休日" チェック
        if (todayText.includes('定休日') || todayText.includes('休業日')) {
            return false;
        }

        // "24 時間営業" チェック
        if (todayText.includes('24 時間営業') || todayText.includes('24時間営業')) {
            return true;
        }

        // 時間範囲を抽出（例: "7時00分～20時00分"）
        const timeRangeMatch = todayText.match(/(\d{1,2})時(\d{2})分?[～〜~-](\d{1,2})時(\d{2})分?/);

        if (timeRangeMatch) {
            const openHour = parseInt(timeRangeMatch[1]);
            const openMinute = parseInt(timeRangeMatch[2]);
            const closeHour = parseInt(timeRangeMatch[3]);
            const closeMinute = parseInt(timeRangeMatch[4]);

            const openTimeInMinutes = openHour * 60 + openMinute;
            let closeTimeInMinutes = closeHour * 60 + closeMinute;

            // 深夜営業の場合（例: 18:00～2:00）
            if (closeTimeInMinutes < openTimeInMinutes) {
                closeTimeInMinutes += 24 * 60; // 翌日扱い
                if (currentTimeInMinutes < openTimeInMinutes) {
                    // 深夜帯（0時～閉店時間）
                    return currentTimeInMinutes <= (closeTimeInMinutes - 24 * 60);
                }
            }

            return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes <= closeTimeInMinutes;
        }

        // 解析できない場合はnull（不明）
        return null;
    },

    /**
     * レビューから混雑度を推定
     * @param {Array} reviews - Place Details のレビュー配列
     * @returns {string|null} 'crowded', 'moderate', 'empty', null
     */
    estimateCongestionFromReviews(reviews) {
        if (!reviews || reviews.length === 0) {
            return null;
        }

        const keywords = {
            crowded: ['行列', '混雑', '満席', '待ち時間', '並ぶ', '人気', '賑わ'],
            empty: ['空いて', 'すいて', 'ガラガラ', '貸切', '穴場']
        };

        let crowdedCount = 0;
        let emptyCount = 0;

        for (const review of reviews.slice(0, 5)) { // 最新5件のレビューを確認
            const text = review.text || '';

            for (const keyword of keywords.crowded) {
                if (text.includes(keyword)) {
                    crowdedCount++;
                    break;
                }
            }

            for (const keyword of keywords.empty) {
                if (text.includes(keyword)) {
                    emptyCount++;
                    break;
                }
            }
        }

        if (crowdedCount > emptyCount && crowdedCount >= 2) {
            return 'crowded';
        } else if (emptyCount > crowdedCount && emptyCount >= 2) {
            return 'empty';
        }

        return null; // 判定不可
    }
};
