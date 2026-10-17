# Điệu salon

## Mở web

Chạy START-WEB.cmd rồi mở http://localhost:8081. Cần Node.js 24, không mở trực tiếp index.html. Render dùng node server.cjs.

## Tài khoản

Đăng ký chỉ yêu cầu họ tên, tên đăng nhập, mật khẩu ít nhất 10 ký tự và số điện thoại có mã quốc gia. Không nhập email, không xác nhận email/SMS, không cần Resend. Số điện thoại được kiểm tra định dạng nhưng chưa xác thực.

Nhân viên tự đăng ký phải được quản lý duyệt trong Chấm công → Tài khoản chờ duyệt mới đăng nhập được. Quản lý tạo tài khoản nhân viên trực tiếp thì tài khoản dùng được ngay. Chỉ quản lý được chấm công; nhân viên xem ca/lương của mình.

Tên quản lý dành riêng trong manager-accounts.json: Manh147prao và dolphineatfish. Kích hoạt bằng SETUP_KEY trong Render Environment, nhập họ tên, số điện thoại và mật khẩu riêng. Tài khoản cũ, ca, lương và đơn không bị xóa khi cập nhật. Email cũ không còn được dùng để kiểm tra đăng nhập hoặc trả về hồ sơ.

## Hồ sơ và chức năng

Tài khoản của tôi: đổi tên, ảnh đại diện; xem số điện thoại của mình. Quản lý xem hồ sơ nhân viên, nhân viên không xem được của người khác. Quản lý nhân viên: thêm, sửa, đặt lại mật khẩu, khóa/mở khóa, xóa mềm giữ lịch sử. Kết thúc ca đang mở trước khi xóa/khóa.

Quản lý ca: thêm, sửa và xóa. Tổng giờ & lương chỉ hiển thị nhân viên chưa xóa. Lương EUR/giờ, trừ phút nghỉ, làm tròn cent từng ca. Lần đặt lương đầu áp dụng cả ca cũ; thay đổi sau áp dụng ca bắt đầu từ lúc lưu. Tiền công ước tính chưa tính thuế, phụ cấp hoặc tăng ca.

Đơn khách & doanh thu chỉ quản lý được dùng: tên khách, ngày thanh toán, nhân viên nhận khách, số tiền cuối cùng EUR. Thêm/sửa/xóa tính lại doanh thu theo tháng, chưa trừ chi phí. Ngày đơn mặc định Europe/Paris; giờ ca hiện vẫn theo múi giờ trình duyệt.

Không tải dữ liệu định kỳ. Dữ liệu cập nhật khi mở mục, bấm Làm mới hoặc thao tác lưu/chấm công.

## Lưu trữ và triển khai

SQLite cục bộ tại data/nail.sqlite; Render tại /var/data/nail.sqlite trên ổ 1 GB. Không tải data hoặc SQLite lên GitHub. Xem DEPLOY.md. Sao lưu thư mục data khi dừng máy chủ. CSV là báo cáo, không phải bản sao lưu đầy đủ.

## Kiểm thử

Chạy node test-server.cjs, node test-online.cjs, node test-registration.cjs và node test-profiles.cjs. Các kiểm thử dùng SQLite tạm, không cần dịch vụ email hoặc SMS.
