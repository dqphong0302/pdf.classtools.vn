# Roboto (Apache-2.0)

Rút gọn từ Roboto 2.138 bằng fontTools, chỉ giữ Latin, Latin mở rộng, tiếng Việt,
dấu câu, tiền tệ, mũi tên:

```bash
pyftsubset Roboto-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-024F,U+0300-0323,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-215F,U+2190-21FF,U+2212,U+2215,U+2022,U+25CF,U+2713,U+2714,U+FEFF" \
  --layout-features='*' --no-hinting --output-file=Roboto-Regular.ttf
```

Bắt buộc phải đi qua bước này: bản Roboto 2.138 gốc làm `@pdf-lib/fontkit`
subset sai (`embedFont(..., { subset: true })` chỉ còn vài glyph, ví dụ
"BẢN SAO" hiển thị thành "A"). Bản đã xử lý lại subset đúng.
