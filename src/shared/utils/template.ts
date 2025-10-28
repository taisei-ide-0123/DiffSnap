/**
 * Template evaluation utilities for DiffSnap
 * ファイル名テンプレートの評価処理
 */

/**
 * テンプレート文字列を評価して実際の値に置換する
 * @param template テンプレート文字列（例: "{date}-{domain}-{w}x{h}-{index}"）
 * @param data 置換データ（キーと値のペア）
 * @returns 評価された文字列
 */
export const evaluateTemplate = (
  template: string,
  data: Record<string, string>
): string => {
  let result = template

  // すべての変数を置換
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    result = result.replace(regex, value || 'untitled')
  })

  // 未置換の変数が残っているかチェック
  const hasInvalidVars = result.includes('{') && result.includes('}')

  return hasInvalidVars ? `❌ ${result}` : result
}
