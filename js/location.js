/**
 * location.js - GPS / Geolocation 取得モジュール
 * ブラウザの Geolocation API で現在地を取得する
 */

const LocationService = (() => {
    /**
     * 現在地を取得する
     * @returns {Promise<{lat: number, lng: number}>}
     */
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('お使いのブラウザは位置情報に対応していません。'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0  // キャッシュ不使用（常に最新の位置を取得）
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    let message;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = '位置情報の使用が許可されていません。ブラウザの設定から位置情報を許可してください。';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = '位置情報を取得できませんでした。';
                            break;
                        case error.TIMEOUT:
                            message = '位置情報の取得がタイムアウトしました。';
                            break;
                        default:
                            message = '位置情報の取得中にエラーが発生しました。';
                    }
                    reject(new Error(message));
                },
                options
            );
        });
    }

    /**
     * 2点間の距離を計算（Haversine公式）
     * @param {number} lat1 
     * @param {number} lng1 
     * @param {number} lat2 
     * @param {number} lng2 
     * @returns {number} 距離（メートル）
     */
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // 地球の半径（メートル）
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * 距離をフォーマット
     * @param {number} meters 
     * @returns {string}
     */
    function formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)}m`;
        }
        return `${(meters / 1000).toFixed(1)}km`;
    }

    /**
     * 徒歩の所要時間を計算（時速4.8km = 分速80m）
     * @param {number} meters 
     * @returns {string}
     */
    function estimateWalkTime(meters) {
        const minutes = Math.ceil(meters / 80);
        return `徒歩${minutes}分`;
    }

    /**
     * タクシーの所要時間を計算（時速20km = 分速333m）※市街地想定
     * @param {number} meters 
     * @returns {string}
     */
    function estimateTaxiTime(meters) {
        const minutes = Math.max(1, Math.ceil(meters / 333));
        return `タクシー${minutes}分`;
    }

    return {
        getCurrentPosition,
        calculateDistance,
        formatDistance,
        estimateWalkTime,
        estimateTaxiTime
    };
})();
