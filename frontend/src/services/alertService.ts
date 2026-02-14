import Swal from 'sweetalert2';
import type { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

export const showSuccess = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonColor: '#2563eb', // Tailwind blue-600
  });
};

export const showError = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonColor: '#dc2626', // Tailwind red-600
  });
};

export const showInfo = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'info',
    title,
    text,
    confirmButtonColor: '#2563eb',
  });
};

export const showConfirmation = (
  title: string,
  text?: string,
  confirmButtonText = 'Yes',
  cancelButtonText = 'Cancel',
  icon: SweetAlertIcon = 'question'
): Promise<SweetAlertResult<any>> => {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#6b7280', // Tailwind gray-500
  });
};

export const showLoading = (title = 'Loading...', text?: string) => {
  Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
    showConfirmButton: false,
    background: '#fff',
  });
};

export const closeAlert = () => {
  Swal.close();
}; 