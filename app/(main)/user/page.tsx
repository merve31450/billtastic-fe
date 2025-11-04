"use client";

import { Card, Form, Input, Button, notification, Avatar, Upload, Space } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";

export default function UserProfilePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({
    name: "",
    surname: "",
    email: "",
    profileImage: "",
  });
  const [preview, setPreview] = useState<string | undefined>();

  // 🔹 Kullanıcı bilgilerini backend'den çek
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Oturum bulunamadı");

        const res = await fetch("http://localhost:8080/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
        const data = await res.json();

        setUserInfo({
          name: data.name,
          surname: data.surname,
          email: data.email,
          profileImage: data.profileImage || "",
        });

        setPreview(
          data.profileImage
            ? `data:image/png;base64,${data.profileImage}`
            : undefined
        );

        form.setFieldsValue({
          name: data.name,
          surname: data.surname,
          email: data.email,
        });
      } catch (err) {
        console.error(err);
        notification.error({
          message: "Kullanıcı bilgileri alınamadı",
          description: String(err),
        });
      }
    })();
  }, [form]);

  // 🔹 Şifreyi değiştir
  const handlePasswordChange = async () => {
    try {
      const values = await form.validateFields([
        "currentPassword",
        "newPassword",
        "confirmPassword",
      ]);

      if (values.newPassword !== values.confirmPassword) {
        notification.error({ message: "Yeni şifreler eşleşmiyor!" });
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token bulunamadı");

      setLoading(true);

      const res = await fetch("http://localhost:8080/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: values.newPassword,
        }),
      });

      if (!res.ok) throw new Error(`Şifre değiştirilemedi: ${res.status}`);

      notification.success({ message: "Şifre başarıyla güncellendi!" });
      form.resetFields(["currentPassword", "newPassword", "confirmPassword"]);
    } catch (err) {
      console.error(err);
      notification.error({
        message: "Şifre güncellenemedi",
        description: String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Profil fotoğrafını yükle
  const handlePhotoUpload = async (file: File) => {
    const token = localStorage.getItem("token");
    if (!token) {
      notification.error({ message: "Oturum bulunamadı" });
      return false;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8080/api/users/me/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Fotoğraf yüklenemedi");

      // 📸 Önizleme güncelle
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);

      notification.success({ message: "Profil fotoğrafı güncellendi!" });
    } catch (err) {
      notification.error({
        message: "Fotoğraf yüklenemedi",
        description: String(err),
      });
    }

    return false; // antd Upload’un otomatik yükleme davranışını engeller
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: 40,
        paddingBottom: 60,
      }}
    >
      <Card
        title="👤 Profil Bilgilerim"
        style={{ width: 520 }}
        bordered={false}
      >
        <Space direction="vertical" align="center" style={{ width: "100%" }}>
          <Avatar
            size={100}
            src={preview}
            style={{ backgroundColor: "#1677ff", fontSize: 32 }}
          >
            {userInfo.name?.[0]}
            {userInfo.surname?.[0]}
          </Avatar>

          <Upload
            beforeUpload={handlePhotoUpload}
            showUploadList={false}
            accept="image/*"
          >
            <Button icon={<UploadOutlined />}>Profil Fotoğrafını Güncelle</Button>
          </Upload>
        </Space>

        <Form
          layout="vertical"
          form={form}
          style={{ marginTop: 32 }}
        >
          <Form.Item label="Ad" name="name">
            <Input disabled />
          </Form.Item>

          <Form.Item label="Soyad" name="surname">
            <Input disabled />
          </Form.Item>

          <Form.Item label="E-posta" name="email">
            <Input disabled />
          </Form.Item>

          <Form.Item
            label="Mevcut Şifre"
            name="currentPassword"
            rules={[{ required: true, message: "Mevcut şifre zorunludur" }]}
          >
            <Input.Password placeholder="Mevcut şifrenizi girin" />
          </Form.Item>

          <Form.Item
            label="Yeni Şifre"
            name="newPassword"
            rules={[{ required: true, message: "Yeni şifre zorunludur" }]}
          >
            <Input.Password placeholder="Yeni şifrenizi girin" />
          </Form.Item>

          <Form.Item
            label="Yeni Şifre (Tekrar)"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Yeni şifreyi tekrar girin" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Şifreler eşleşmiyor!"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Yeni şifrenizi tekrar girin" />
          </Form.Item>

          <Button
            type="primary"
            onClick={handlePasswordChange}
            loading={loading}
            block
          >
            Şifreyi Güncelle
          </Button>
        </Form>
      </Card>
    </div>
  );
}

