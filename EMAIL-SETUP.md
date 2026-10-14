# Email xác nhận thật

Mã nguồn đã tích hợp API Resend. Chưa có khóa dịch vụ nên chưa thử gửi tới hộp thư thực; kiểm thử dùng bộ gửi giả lập tách riêng trong test-profiles.cjs. Ứng dụng không xác nhận email bằng mã hiển thị trong giao diện.

## Cấu hình trên Render

1. Tạo tài khoản Resend: https://resend.com.
2. Thêm tên miền gửi email mà bạn sở hữu trong Domains, thêm bản ghi DNS theo hướng dẫn và chờ Verified. Địa chỉ onrender.com không phải tên miền bạn sở hữu để xác minh gửi thư.
3. Tạo API key với quyền gửi email cho tên miền đã xác minh.
4. Trong Render → dịch vụ → Environment, đặt RESEND_API_KEY và EMAIL_FROM (ví dụ Điệu salon <noreply@tenmien-cua-ban.fr>). Không tải khóa lên GitHub hoặc gửi vào chat.
5. Triển khai lại. Đăng ký/khởi tạo một tài khoản thật, mở email và liên kết xác nhận để kiểm tra gửi thực tế; kiểm tra cả thư rác.

Hướng dẫn chính thức: https://resend.com/docs/api-reference/emails/send-email và https://resend.com/docs/dashboard/domains/introduction.

## Luồng tài khoản

Tạo tài khoản bắt buộc email và điện thoại quốc tế (+33 hoặc +84). Email được lưu duy nhất theo tài khoản. Điện thoại chỉ kiểm tra định dạng, luôn hiển thị chưa xác thực. Nhân viên phải xác nhận email và được quản lý duyệt trước khi đăng nhập. Quản lý mới cũng phải xác nhận email. Liên kết dùng một lần, hết hạn 24 giờ.

Gửi lại email: nhập tên đăng nhập/mật khẩu ở trang đăng nhập rồi bấm Gửi lại email xác nhận. Tối đa 5 lần/tài khoản/ngày và 100 lần/ngày cho tiệm; ít nhất 60 giây giữa các lần. Giới hạn này giảm gửi thư quá mức, không thay thế hạn mức chi phí của nhà cung cấp.

Nếu gửi thư thất bại sau khi lưu tài khoản, dùng Gửi lại email xác nhận thay vì đăng ký lại. Nếu chưa cấu hình dịch vụ, ứng dụng từ chối tạo tài khoản mới, không giả lập xác nhận.

Tài khoản cũ được giữ nguyên. Hồ sơ cũ có thể chưa có email/điện thoại; bản này chưa hỗ trợ thay đổi địa chỉ email đã đăng ký. Tên và ảnh đại diện thay đổi trong Tài khoản của tôi. Quản lý xem hồ sơ nhân viên trong Quản lý nhân viên → Xem hồ sơ. Nhân viên bị chặn truy cập hồ sơ người khác ở máy chủ.
