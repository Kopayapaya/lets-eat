/**
 * places.js - Google Places API 連携モジュール
 * 周辺の飲食店を検索し、写真・評価・詳細情報を取得する
 */

const PlacesService = (() => {
    let service = null;
    let map = null;

    // カテゴリ → Places API type マッピング
    const CATEGORY_TYPE_MAP = {
        restaurant: 'restaurant',
        cafe: 'cafe',
        bar: 'bar'
    };

    // 予算 → Places API price level マッピング
    const BUDGET_PRICE_MAP = {
        '1000': { min: 0, max: 1 },
        '3000': { min: 1, max: 2 },
        '5000': { min: 2, max: 3 },
        '10000': { min: 3, max: 4 },
        '10001': { min: 3, max: 4 }
    };

    // Place types → 雰囲気タグ マッピング
    const ATMOSPHERE_TAGS = {
        'fine_dining_restaurant': '🌟 高級ダイニング',
        'japanese_restaurant': '🏯 和の雰囲気',
        'french_restaurant': '🇫🇷 フレンチ',
        'italian_restaurant': '🇮🇹 イタリアン',
        'steak_house': '🥩 ステーキハウス',
        'sushi_restaurant': '🍣 寿司',
        'seafood_restaurant': '🦞 シーフード',
        'brunch_restaurant': '🥞 ブランチ',
        'ramen_restaurant': '🍜 ラーメン',
        'barbecue_restaurant': '🔥 焼肉・BBQ',
        'bar': '🥂 バー',
        'wine_bar': '🍷 ワインバー',
        'cocktail_bar': '🍸 カクテルバー',
        'cafe': '☕ カフェ',
        'coffee_shop': '☕ コーヒーショップ'
    };

    /**
     * Places Serviceを初期化
     */
    function init() {
        const mapDiv = document.createElement('div');
        mapDiv.style.display = 'none';
        document.body.appendChild(mapDiv);
        map = new google.maps.Map(mapDiv);
        service = new google.maps.places.PlacesService(map);
    }

    /**
     * 周辺のお店を検索
     * @param {{lat: number, lng: number}} location - 現在地
     * @param {Object} filters - フィルター設定
     * @returns {Promise<Array>} - 店舗リスト
     */
    function searchNearby(location, filters) {
        return new Promise((resolve, reject) => {
            if (!service) {
                reject(new Error('Places APIが初期化されていません。ページを再読み込みしてください。'));
                return;
            }

            const type = CATEGORY_TYPE_MAP[filters.category] || 'restaurant';
            const radius = parseInt(filters.distance) || 800;

            const request = {
                location: new google.maps.LatLng(location.lat, location.lng),
                radius: radius,
                type: type,
                openNow: true,
                language: 'ja'
            };

            // キーワード検索（ジャンル + 喫煙）
            const keywords = [];
            if (filters.cuisine) {
                keywords.push(filters.cuisine);
            }
            if (filters.smoking === 'allowed') {
                keywords.push('喫煙可');
            } else if (filters.smoking === 'no-smoking') {
                keywords.push('禁煙');
            }
            if (keywords.length > 0) {
                request.keyword = keywords.join(' ');
            }

            console.log('Places API リクエスト:', { ...request, location: `${location.lat}, ${location.lng}`, radius });

            service.nearbySearch(request, (results, status) => {
                console.log('Places API ステータス:', status);
                console.log('Places API 結果件数:', results ? results.length : 0);

                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    let places = results.map(place => formatPlace(place, location));

                    // 営業中の店舗のみ表示（isOpen === true のみ通す）
                    // openNow: true でAPI側でもフィルタしているが、念のため二重チェック
                    places = places.filter(p => p.isOpen === true);

                    // 距離でフィルタリング（API radius は概算なので正確に絞る）
                    places = places.filter(p => p.distance <= radius);

                    // 予算フィルタリング
                    if (filters.budget) {
                        const priceRange = BUDGET_PRICE_MAP[filters.budget];
                        if (priceRange) {
                            places = places.filter(p => {
                                if (p.priceLevel === undefined || p.priceLevel === null) return true;
                                return p.priceLevel >= priceRange.min && p.priceLevel <= priceRange.max;
                            });
                        }
                    }

                    // 評価順にソート（高い順 → 同評価ならレビュー数順）
                    places.sort((a, b) => {
                        const ratingDiff = (b.rating || 0) - (a.rating || 0);
                        if (ratingDiff !== 0) return ratingDiff;
                        return (b.ratingsTotal || 0) - (a.ratingsTotal || 0);
                    });

                    resolve(places);
                } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    resolve([]);
                } else {
                    let errorMsg = 'お店の検索に失敗しました。';
                    if (status === 'REQUEST_DENIED') {
                        errorMsg = 'APIキーが無効、または「Places API」が有効化されていません。Google Cloud Consoleで「Places API」（※ New ではない方）を有効にしてください。';
                    } else if (status === 'OVER_QUERY_LIMIT') {
                        errorMsg = 'API使用制限を超えました。しばらく待ってからお試しください。';
                    } else if (status === 'INVALID_REQUEST') {
                        errorMsg = 'リクエストが無効です。ページを再読み込みしてください。';
                    }
                    console.error('Places API エラー:', status, errorMsg);
                    reject(new Error(errorMsg));
                }
            });
        });
    }

    /**
     * 店舗の詳細情報を取得（モーダル表示時に呼び出し）
     * @param {string} placeId
     * @returns {Promise<Object>}
     */
    function getPlaceDetails(placeId) {
        return new Promise((resolve, reject) => {
            if (!service) {
                reject(new Error('Places APIが初期化されていません'));
                return;
            }

            const request = {
                placeId: placeId,
                fields: [
                    'opening_hours',
                    'reviews',
                    'types',
                    'editorial_summary',
                    'website',
                    'formatted_phone_number',
                    'url'
                ],
                language: 'ja'
            };

            service.getDetails(request, (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                    resolve({
                        openingHours: place.opening_hours || null,
                        reviews: place.reviews || [],
                        types: place.types || [],
                        editorialSummary: place.editorial_summary ? place.editorial_summary.text : null,
                        website: place.website || null,
                        phone: place.formatted_phone_number || null,
                        mapsUrl: place.url || null
                    });
                } else {
                    console.warn('Place Details 取得失敗:', status);
                    resolve(null); // エラーでも表示を止めない
                }
            });
        });
    }

    /**
     * Places APIの結果を整形
     */
    function formatPlace(place, userLocation) {
        const distance = LocationService.calculateDistance(
            userLocation.lat,
            userLocation.lng,
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );

        let isOpen = null;
        try {
            if (place.opening_hours) {
                isOpen = place.opening_hours.isOpen();
            }
        } catch (e) {
            isOpen = null;
        }

        return {
            id: place.place_id,
            name: place.name,
            rating: place.rating || null,
            ratingsTotal: place.user_ratings_total || 0,
            priceLevel: place.price_level,
            address: place.vicinity || '',
            isOpen: isOpen,
            types: place.types || [],
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            distance: distance,
            distanceText: LocationService.formatDistance(distance),
            walkTime: LocationService.estimateWalkTime(distance),
            taxiTime: LocationService.estimateTaxiTime(distance),
            photoUrl: getPhotoUrl(place),
            icon: place.icon,
            congestion: estimateCongestion(place)
        };
    }

    /**
     * 店舗の写真URLを取得
     */
    function getPhotoUrl(place) {
        if (place.photos && place.photos.length > 0) {
            return place.photos[0].getUrl({ maxWidth: 600, maxHeight: 600 });
        }
        return null;
    }

    /**
     * 混雑度を予測（時間帯 + レビュー数 + 評価で推定）
     * @returns {{ level: string, label: string, color: string }}
     */
    function estimateCongestion(place) {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0=日, 6=土
        const isWeekend = day === 0 || day === 6;
        const reviewCount = place.user_ratings_total || 0;
        const rating = place.rating || 3.0;

        // 時間帯スコア（ピーク時間ほど高い）
        let timeScore = 0;
        if ((hour >= 11 && hour <= 13) || (hour >= 18 && hour <= 20)) {
            timeScore = 3; // ピーク
        } else if ((hour >= 14 && hour <= 17)) {
            timeScore = 1; // 閑散
        } else {
            timeScore = 2; // 通常
        }

        // 週末は +1
        if (isWeekend) timeScore += 1;

        // 人気度スコア（レビュー数ベース）
        let popularityScore = 0;
        if (reviewCount > 500) popularityScore = 3;
        else if (reviewCount > 100) popularityScore = 2;
        else if (reviewCount > 30) popularityScore = 1;

        // 高評価の店は混みやすい
        if (rating >= 4.3) popularityScore += 1;

        const totalScore = timeScore + popularityScore;

        if (totalScore >= 6) {
            return { level: 'high', label: '混雑', color: '#e57373' };
        } else if (totalScore >= 4) {
            return { level: 'medium', label: 'やや混雑', color: '#ffb74d' };
        } else if (totalScore >= 2) {
            return { level: 'low', label: '普通', color: '#81c784' };
        } else {
            return { level: 'empty', label: '空いている', color: '#4fc3f7' };
        }
    }

    /**
     * Place types から雰囲気タグを生成
     */
    function getAtmosphereTags(types) {
        const tags = [];
        if (types && types.length > 0) {
            types.forEach(type => {
                if (ATMOSPHERE_TAGS[type]) {
                    tags.push(ATMOSPHERE_TAGS[type]);
                }
            });
        }
        return tags;
    }

    /**
     * レビューから雰囲気キーワードを抽出
     */
    function extractAtmosphereFromReviews(reviews) {
        const keywords = [
            { pattern: /高層|眺め|景色|ビュー|夜景|view/i, tag: '🏙️ 眺望が良い' },
            { pattern: /一軒家|隠れ家|古民家/i, tag: '🏠 一軒家・隠れ家' },
            { pattern: /個室|プライベート|半個室/i, tag: '🚪 個室あり' },
            { pattern: /テラス|屋上|オープン/i, tag: '🌿 テラス席' },
            { pattern: /デート|記念日|誕生日|ロマンチック/i, tag: '💑 デート向き' },
            { pattern: /おしゃれ|スタイリッシュ|モダン/i, tag: '✨ おしゃれ' },
            { pattern: /落ち着|静か|大人|上品/i, tag: '🕯️ 落ち着いた雰囲気' },
            { pattern: /広い|開放|ゆったり/i, tag: '🏛️ 開放的' },
            { pattern: /カウンター|一人|ソロ/i, tag: '🍸 カウンター席' },
            { pattern: /接客|サービス|ホスピタリティ/i, tag: '👤 サービス◎' },
            { pattern: /コスパ|リーズナブル|お得/i, tag: '💰 コスパ良好' }
        ];

        const found = new Set();
        reviews.forEach(review => {
            const text = review.text || '';
            keywords.forEach(({ pattern, tag }) => {
                if (pattern.test(text) && found.size < 4) {
                    found.add(tag);
                }
            });
        });

        return Array.from(found);
    }

    /**
     * 価格レベルを日本語テキストに変換
     */
    function formatPriceLevel(level) {
        if (level === undefined || level === null) return '';
        const labels = ['無料', '~¥1,000', '¥1,000~3,000', '¥3,000~5,000', '¥5,000~'];
        return labels[level] || '';
    }

    /**
     * Google Maps のナビゲーション URL を生成
     */
    function getNavigationUrl(place) {
        return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&destination_place_id=${place.id}&travelmode=walking`;
    }

    /**
     * 食べログの検索URLを生成
     */
    function getTabelogSearchUrl(place) {
        const query = encodeURIComponent(place.name);
        return `https://tabelog.com/rstLst/?vs=1&sk=${query}`;
    }

    return {
        init,
        searchNearby,
        getPlaceDetails,
        formatPriceLevel,
        getNavigationUrl,
        getTabelogSearchUrl,
        getAtmosphereTags,
        extractAtmosphereFromReviews
    };
})();
