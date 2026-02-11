/**
 * ui.js - UI操作・アニメーション モジュール
 * カード生成、モーダル制御、画面遷移、トーストを管理
 */

const UI = (() => {
    // DOM要素キャッシュ
    const screens = {
        top: document.getElementById('screen-top'),
        loading: document.getElementById('screen-loading'),
        results: document.getElementById('screen-results')
    };

    const els = {
        loadingText: document.getElementById('loading-text'),
        resultsGrid: document.getElementById('results-grid'),
        resultsCount: document.getElementById('results-count'),
        noResults: document.getElementById('no-results'),
        modal: document.getElementById('modal-detail'),
        modalPhoto: document.getElementById('modal-photo'),
        modalName: document.getElementById('modal-name'),
        modalRating: document.getElementById('modal-rating'),
        modalReviews: document.getElementById('modal-reviews'),
        modalPrice: document.getElementById('modal-price'),
        modalCongestion: document.getElementById('modal-congestion'),
        modalAppeal: document.getElementById('modal-appeal'),
        modalAddress: document.getElementById('modal-address'),
        modalDistance: document.getElementById('modal-distance'),
        modalStatus: document.getElementById('modal-status'),
        modalHoursRow: document.getElementById('modal-hours-row'),
        modalHours: document.getElementById('modal-hours'),
        modalSmokingRow: document.getElementById('modal-smoking-row'),
        modalSmoking: document.getElementById('modal-smoking'),
        modalNavigate: document.getElementById('modal-navigate'),
        modalTabelog: document.getElementById('modal-tabelog'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toast-message')
    };

    /**
     * 画面を切り替え
     */
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
        }
    }

    /**
     * ローディングテキストを更新
     */
    function setLoadingText(text) {
        els.loadingText.textContent = text;
    }

    /**
     * 検索結果のカードを生成・表示
     * @param {Array} places - 店舗リスト
     */
    function renderResults(places) {
        els.resultsGrid.innerHTML = '';

        if (places.length === 0) {
            els.noResults.classList.remove('hidden');
            els.resultsCount.textContent = '';
            return;
        }

        els.noResults.classList.add('hidden');
        els.resultsCount.textContent = `${places.length}件のお店が見つかりました`;

        places.forEach((place, index) => {
            const card = createCard(place, index);
            els.resultsGrid.appendChild(card);
        });
    }

    /**
     * 店舗カードを生成
     */
    function createCard(place, index) {
        const card = document.createElement('div');
        card.className = 'place-card';
        card.style.animationDelay = `${index * 0.06}s`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${place.name} - 評価${place.rating || '未評価'}`);

        // 写真
        let photoHTML;
        if (place.photoUrl) {
            photoHTML = `<img class="card-photo" src="${place.photoUrl}" alt="${escapeHtml(place.name)}" loading="lazy">`;
        } else {
            photoHTML = `<div class="card-no-photo">🍽️</div>`;
        }

        // 評価の星
        const ratingHTML = place.rating
            ? `<span class="card-rating"><span class="card-rating-star">⭐</span>${place.rating.toFixed(1)}</span>`
            : '';

        // 価格
        const priceText = PlacesService.formatPriceLevel(place.priceLevel);
        const priceHTML = priceText ? `<span class="card-price">${priceText}</span>` : '';

        // 混雑度バッジ
        const congestionHTML = place.congestion
            ? `<span class="card-congestion" style="background: ${place.congestion.color}22; color: ${place.congestion.color}; border-color: ${place.congestion.color}44">${place.congestion.label}</span>`
            : '';

        card.innerHTML = `
            ${photoHTML}
            <div class="card-overlay">
                <div class="card-badges">
                    ${congestionHTML}
                </div>
                <p class="card-name">${escapeHtml(place.name)}</p>
                <div class="card-meta">
                    ${ratingHTML}
                    <span class="card-distance">🚶${place.distanceText}</span>
                    ${priceHTML}
                </div>
            </div>
        `;

        // クリック → 詳細モーダル
        card.addEventListener('click', () => openModal(place));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal(place);
            }
        });

        return card;
    }

    /**
     * 詳細モーダルを開く（Place Details APIも呼び出し）
     */
    async function openModal(place) {
        // 写真
        if (place.photoUrl) {
            els.modalPhoto.src = place.photoUrl;
            els.modalPhoto.alt = place.name;
            els.modalPhoto.style.display = 'block';
        } else {
            els.modalPhoto.style.display = 'none';
        }

        // 店名
        els.modalName.textContent = place.name;

        // 評価
        if (place.rating) {
            const stars = renderStars(place.rating);
            els.modalRating.innerHTML = `${stars} ${place.rating.toFixed(1)}`;
            els.modalRating.style.display = '';
        } else {
            els.modalRating.style.display = 'none';
        }

        // レビュー数
        els.modalReviews.textContent = place.ratingsTotal > 0
            ? `(${place.ratingsTotal}件のレビュー)`
            : '';

        // 価格帯
        const priceText = PlacesService.formatPriceLevel(place.priceLevel);
        els.modalPrice.textContent = priceText;
        els.modalPrice.style.display = priceText ? '' : 'none';

        // 混雑度
        if (place.congestion) {
            els.modalCongestion.innerHTML = `
                <span class="congestion-badge" style="background: ${place.congestion.color}15; color: ${place.congestion.color}; border: 1px solid ${place.congestion.color}33">
                    <span class="congestion-dot" style="background: ${place.congestion.color}"></span>
                    混雑予想: ${place.congestion.label}
                </span>
            `;
            els.modalCongestion.style.display = '';
        } else {
            els.modalCongestion.style.display = 'none';
        }

        // 初期状態：雰囲気エリアを非表示
        els.modalAppeal.classList.add('hidden');
        els.modalAppeal.innerHTML = '';
        els.modalHoursRow.classList.add('hidden');

        // 住所
        els.modalAddress.textContent = place.address || '住所不明';

        // 距離 & 時間
        els.modalDistance.textContent = `${place.distanceText}（${place.walkTime} / ${place.taxiTime}）`;

        // 営業中
        if (place.isOpen !== null) {
            els.modalStatus.textContent = place.isOpen ? '営業中' : '営業時間外';
            els.modalStatus.style.color = place.isOpen ? '#81c784' : '#e57373';
        } else {
            els.modalStatus.textContent = '営業時間不明';
            els.modalStatus.style.color = '';
        }

        // ナビゲーションリンク
        els.modalNavigate.href = PlacesService.getNavigationUrl(place);

        // 食べログリンク
        els.modalTabelog.href = PlacesService.getTabelogSearchUrl(place);

        // モーダル表示
        els.modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            els.modal.classList.add('showing');
        });
        document.body.style.overflow = 'hidden';

        // --- Place Details API を非同期で呼び出し ---
        try {
            const details = await PlacesService.getPlaceDetails(place.id);
            if (details) {
                updateModalWithDetails(place, details);
            }
        } catch (e) {
            console.warn('詳細情報の取得に失敗:', e);
        }
    }

    /**
     * Place Details の情報でモーダルを更新
     */
    function updateModalWithDetails(place, details) {
        // 正確な営業状態を表示
        if (details.isActuallyOpen === false) {
            // 営業時間外と確定
            els.modalStatus.innerHTML = '<span style="color: #ef5350;">🕐 営業時間外</span>';
        } else if (details.isActuallyOpen === true) {
            // 営業中と確定
            els.modalStatus.innerHTML = '<span style="color: #66bb6a;">🕐 営業中</span>';
        }

        // 今日の営業時間
        if (details.openingHours && details.openingHours.weekday_text) {
            const today = new Date().getDay();
            // Google は月曜始まり (0=月, 6=日)
            const googleDayIndex = today === 0 ? 6 : today - 1;
            const todayText = details.openingHours.weekday_text[googleDayIndex];
            if (todayText) {
                els.modalHours.textContent = todayText;
                els.modalHoursRow.classList.remove('hidden');
            }
        }

        // レビューベースの混雑度調整
        if (details.reviews && details.reviews.length > 0) {
            const reviewCongestion = HoursParser.estimateCongestionFromReviews(details.reviews);

            // レビューで強い傾向が見られた場合は混雑バッジを更新
            if (reviewCongestion === 'crowded') {
                // 「行列」「混雑」などのキーワードが多い
                const congestionBadge = els.modalCongestion.querySelector('.congestion-badge');
                if (congestionBadge && !congestionBadge.textContent.includes('混雑')) {
                    congestionBadge.textContent = '🔥 混雑しやすい';
                    congestionBadge.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)';
                }
            } else if (reviewCongestion === 'empty') {
                // 「空いて」「穴場」などのキーワードが多い
                const congestionBadge = els.modalCongestion.querySelector('.congestion-badge');
                if (congestionBadge) {
                    congestionBadge.textContent = '✨ 穴場';
                    congestionBadge.style.background = 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 100%)';
                }
            }
        }

        // 雰囲気・アピールポイント
        const appealTags = [];

        // Place types からタグ生成
        const typeTags = PlacesService.getAtmosphereTags(details.types);
        appealTags.push(...typeTags);

        // レビューから雰囲気キーワード抽出
        if (details.reviews && details.reviews.length > 0) {
            const reviewTags = PlacesService.extractAtmosphereFromReviews(details.reviews);
            reviewTags.forEach(tag => {
                if (!appealTags.includes(tag)) {
                    appealTags.push(tag);
                }
            });
        }

        // エディトリアルサマリー
        if (details.editorialSummary) {
            appealTags.unshift(`📝 ${details.editorialSummary}`);
        }

        // アピールタグを表示
        if (appealTags.length > 0) {
            els.modalAppeal.innerHTML = `
                <div class="appeal-label">雰囲気・特徴</div>
                <div class="appeal-tags">
                    ${appealTags.map(tag => `<span class="appeal-tag">${tag}</span>`).join('')}
                </div>
            `;
            els.modalAppeal.classList.remove('hidden');
        }

        // 喫煙情報をレビューから抽出
        if (details.reviews && details.reviews.length > 0) {
            const smokingInfo = extractSmokingInfo(details.reviews);
            if (smokingInfo) {
                els.modalSmoking.textContent = smokingInfo;
                els.modalSmokingRow.classList.remove('hidden');
            } else {
                els.modalSmokingRow.classList.add('hidden');
            }
        } else {
            els.modalSmokingRow.classList.add('hidden');
        }
    }

    /**
     * レビューから喫煙情報を抽出
     */
    function extractSmokingInfo(reviews) {
        const keywords = [
            { pattern: /喫煙可|喫煙室|喫煙席/i, info: '喫煙可' },
            { pattern: /分煙/i, info: '分煙' },
            { pattern: /完全禁煙|禁煙席|禁煙/i, info: '禁煙' }
        ];

        for (const review of reviews) {
            const text = review.text || '';
            for (const { pattern, info } of keywords) {
                if (pattern.test(text)) {
                    return info;
                }
            }
        }
        return null;
    }

    /**
     * モーダルを閉じる
     */
    function closeModal() {
        els.modal.classList.remove('showing');
        els.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /**
     * 評価の星をHTML文字列で生成
     */
    function renderStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        let html = '';
        for (let i = 0; i < fullStars; i++) {
            html += '★';
        }
        if (halfStar) {
            html += '★';
        }
        const totalStars = fullStars + (halfStar ? 1 : 0);
        for (let i = totalStars; i < 5; i++) {
            html += '☆';
        }
        return html;
    }

    /**
     * トースト通知を表示
     */
    function showToast(message, duration = 4000) {
        els.toastMessage.textContent = message;
        els.toast.classList.remove('hidden');
        clearTimeout(els.toast._timeout);
        els.toast._timeout = setTimeout(() => {
            els.toast.classList.add('hidden');
        }, duration);
    }

    /**
     * HTML エスケープ
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // モーダルのイベント設定
    document.getElementById('btn-modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', closeModal);

    return {
        showScreen,
        setLoadingText,
        renderResults,
        openModal,
        closeModal,
        showToast
    };
})();
