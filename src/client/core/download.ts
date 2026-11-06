export function downloadBytes(name: string, data: string, type: string) {
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const url = URL.createObjectURL(new Blob([bytes], {type}))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function fileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(Error('读取文件失败'))
        reader.onload = () => resolve(String(reader.result).split(',', 2)[1])
        reader.readAsDataURL(file)
    })
}
