/**
 * app.js - メインアプリケーション ロジック
 * フィルター管理、検索フロー制御、イベントハンドラ
 */

// --- アプリの状態 ---
const AppState = {
    filters: {
        category: 'restaurant',
        distance: '400',   // デフォルト: 徒歩5分 = 400m
        budget: null,
        smoking: 'any',    // デフォルト: 指定なし
        cuisine: null
    },
    currentLocation: null,
    places: [],
    isSearching: false
};

// --- フィルター管理 ---

/**
 * フィルターボタンのクリック処理
 */
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const value = btn.dataset.value;

            if (type === 'category') {
                // カテゴリは単一選択（常にどれか1つ）
                document.querySelectorAll(`[data-type="category"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.filters.category = value;

                // Cuisine フィルターの表示/非表示を切り替え
                const cuisineGroup = document.getElementById('filter-group-cuisine');
                if (value === 'restaurant') {
                    cuisineGroup.style.display = '';
                } else {
                    cuisineGroup.style.display = 'none';
                    // レストラン以外の場合はCuisine選択をリセット
                    AppState.filters.cuisine = null;
                    document.querySelectorAll(`[data-type="cuisine"]`).forEach(b => b.classList.remove('active'));
                }
            } else if (type === 'distance') {
                // 距離は単一選択（常にどれか1つ）
                document.querySelectorAll(`[data-type="distance"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.filters.distance = value;
            } else if (type === 'budget') {
                // 予算はトグル（再度クリックで解除）
                const isActive = btn.classList.contains('active');
                document.querySelectorAll(`[data-type="budget"]`).forEach(b => b.classList.remove('active'));
                if (!isActive) {
                    btn.classList.add('active');
                    AppState.filters.budget = value;
                } else {
                    AppState.filters.budget = null;
                }
            } else if (type === 'smoking') {
                // 喫煙は単一選択（常にどれか1つ）
                document.querySelectorAll(`[data-type="smoking"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.filters.smoking = value;
            } else if (type === 'cuisine') {
                // ジャンルはトグル
                const isActive = btn.classList.contains('active');
                document.querySelectorAll(`[data-type="cuisine"]`).forEach(b => b.classList.remove('active'));
                if (!isActive) {
                    btn.classList.add('active');
                    AppState.filters.cuisine = value;
                } else {
                    AppState.filters.cuisine = null;
                }
            }
        });
    });
}

// --- 検索フロー ---

/**
 * メイン検索処理
 * GPS取得 → Places API検索 → 結果表示
 */
async function startSearch() {
    if (AppState.isSearching) return;
    AppState.isSearching = true;

    try {
        // 1. ローディング画面に遷移
        UI.showScreen('loading');
        UI.setLoadingText('位置情報を取得中...');

        // 2. GPS取得
        AppState.currentLocation = await LocationService.getCurrentPosition();
        UI.setLoadingText('近くのお店を検索中...');

        // 3. Places API 検索（距離フィルター反映）
        AppState.places = await PlacesService.searchNearby(
            AppState.currentLocation,
            AppState.filters
        );

        // 4. 結果画面に遷移
        UI.showScreen('results');
        UI.renderResults(AppState.places);

    } catch (error) {
        console.error('検索エラー:', error);
        UI.showToast(error.message || 'エラーが発生しました');
        UI.showScreen('top');
    } finally {
        AppState.isSearching = false;
    }
}

// --- イベント設定 ---

function setupEvents() {
    // Let's Eat ボタン
    document.getElementById('btn-lets-eat').addEventListener('click', startSearch);

    // 戻るボタン
    document.getElementById('btn-back').addEventListener('click', () => {
        UI.showScreen('top');
    });

    // 再検索ボタン
    document.getElementById('btn-refresh').addEventListener('click', startSearch);

    // リトライボタン（結果0件時）
    document.getElementById('btn-retry').addEventListener('click', () => {
        UI.showScreen('top');
    });
}

// --- 初期化 ---

/**
 * Google Maps API 読み込み完了時のコールバック
 */
function initApp() {
    PlacesService.init();
    setupFilters();
    setupEvents();
    console.log('Let\'s Eat 初期化完了 🍽️');
}
