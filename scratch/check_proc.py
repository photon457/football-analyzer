import subprocess

out = subprocess.check_output('wmic process where "name=\'node.exe\'" get processid,commandline', shell=True).decode(errors='ignore')
for l in out.splitlines():
    if 'football' in l.lower() or 'vite' in l.lower():
        print(l.strip())
