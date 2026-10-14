# Đưa Nail Boutique lên Render

## 1. Tạo kho GitHub riêng tư

Đăng nhập GitHub, chọn New repository, tên nail-boutique, chọn Private rồi Create repository. Chọn Add file → Upload files. Tải lên server.cjs, profiles.cjs, manager-accounts.json, package.json, render.yaml, các tệp test và toàn bộ thư mục dist. Các tệp này phải nằm ở gốc kho. Không tải data, tệp SQLite, .git hoặc .openai lên.

## 2. Triển khai Render

Đăng nhập https://dashboard.render.com, kết nối tài khoản GitHub, chọn New → Blueprint và chọn kho nail-boutique. Render đọc render.yaml, tạo Node web service tại Frankfurt và ổ dữ liệu 1 GB. Kiểm tra phí hiển thị trước khi xác nhận: cấu hình dùng gói Starter có phí và ổ dữ liệu có phí. Không chọn Free với SQLite.

## 3. Tạo tài khoản quản lý

Sau khi dịch vụ báo Live, mở URL HTTPS mà Render cấp. Trong trang Environment của dịch vụ, xem giá trị SETUP_KEY được Render tạo tự động. Chọn Kích hoạt tài khoản quản lý trên website, chọn Manh147prao, nhập họ tên, mã thiết lập này và mật khẩu riêng ít nhất 10 ký tự. Đăng xuất rồi kích hoạt dolphineatfish tương tự. Không gửi SETUP_KEY hoặc mật khẩu trong chat hay đưa vào GitHub. Chỉ hai tên đã dành riêng được kích hoạt; mỗi tên chỉ kích hoạt một lần.

## 4. Dùng tại tiệm

Quản lý tạo tài khoản nhân viên, gửi đường dẫn web và thông tin đăng nhập riêng cho từng người. Kiểm tra từ điện thoại: đăng nhập, vào ca, ra ca, xem giờ; kiểm tra nhân viên không thấy dữ liệu người khác. Giữ SETUP_KEY trong Environment vì máy chủ kiểm tra cấu hình lúc khởi động.

## Dữ liệu và tên miền

SQLite nằm tại /var/data/nail.sqlite trên ổ gắn riêng. Chỉ dữ liệu trong /var/data được giữ qua triển khai lại. Bản online mới không tự có dữ liệu từ localhost; bắt đầu bằng dữ liệu mới, hoặc thực hiện chuyển dữ liệu riêng. CSV là báo cáo, không phải bản sao lưu đầy đủ.

Nếu thêm tên miền riêng, đặt PUBLIC_ORIGIN thành URL HTTPS của tên miền (không có đường dẫn). Mặc định dùng RENDER_EXTERNAL_URL. Cấu hình này chỉ cho phép một địa chỉ chuẩn. Bản đầu chạy một instance với SQLite.

Website chưa được triển khai tự động: cần tài khoản GitHub/Render của chủ sở hữu và xác nhận chi phí trên Render. Múi giờ báo cáo hiện vẫn theo trình duyệt, chưa cố định Europe/Paris giữa các thiết bị. Trước khi sử dụng chính thức tại Pháp cần thống nhất múi giờ và kiểm tra sao lưu/khôi phục dữ liệu.


## Email và hồ sơ
Trước khi tạo tài khoản mới, cấu hình RESEND_API_KEY và EMAIL_FROM trên Render theo EMAIL-SETUP.md. Tài khoản mới bắt buộc email và điện thoại; email phải xác nhận thật, điện thoại chưa xác thực. Không tải khóa API hoặc dữ liệu SQLite lên kho.
